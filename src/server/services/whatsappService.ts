import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion,
  delay
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import path from "path";
import fs from "fs";
import pino from "pino";
import { db } from "./supabaseService.ts";
import { parseMessage, parseWithRules } from "./parserService.ts";

const logger = pino({ level: "error" });

export class WhatsAppService {
  private socket: any = null;
  private qr: string | null = null;
  private status: "disconnected" | "connecting" | "connected" = "disconnected";
  private monitoredGroupJid: string | null = null;
  private reconnectionAttempts = 0;
  private readonly MAX_RECONNECTION_ATTEMPTS = 5;
  
  private isInitializing = false;

  // Helper para salvar eventos parseados
  private async saveParsedEvents(events: any[], rawText: string, groupJid: string | null) {
      for (const parsedData of events) {
          if (parsedData.date || parsedData.location || parsedData.title) {
              const eventDate = parsedData.date || (parsedData.startDate ? (isNaN(new Date(parsedData.startDate).getTime()) ? null : new Date(parsedData.startDate).toISOString().split('T')[0]) : null);
              const eventData = {
                  raw_text: rawText,
                  title: parsedData.title,
                  description: parsedData.description || "",
                  event_date: eventDate,
                  start_time: parsedData.time || parsedData.startTime,
                  location: parsedData.location,
                  client: parsedData.client || null,
                  guests: parsedData.guests != null ? parsedData.guests : null,
                  status: "pending",
                  created_at: new Date().toISOString(),
                  group_jid: groupJid,
              };
              
              const existing = await db.findEvent(eventData);
              if (!existing) {
                  await db.saveEvent(eventData);
                  // console.log("Event saved to Supabase:", parsedData.title);
              } else {
                  // console.log("Event already exists, skipping:", parsedData.title);
              }
          }
      }
  }

  async init() {
    if (this.isInitializing) return;
    this.isInitializing = true;

    // If a socket already exists, try to clean it up before re-initializing
    if (this.socket) {
        try {
            await this.socket.end();
            this.socket.ev.removeAllListeners("connection.update");
            this.socket.ev.removeAllListeners("creds.update");
            this.socket.ev.removeAllListeners("messages.upsert");
        } catch (e) {
            console.warn("WhatsApp: Error cleaning up previous socket connection", e);
        }
        this.socket = null;
    }

    // Load config
    const savedJid = await db.getSettings("monitored_group_jid");
    this.monitoredGroupJid = savedJid || null;

    const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
    // Ensure we fetch the latest connection version each time we init
    const { version } = await fetchLatestBaileysVersion();

    this.socket = makeWASocket({
      version,
      logger,
      auth: state,
      printQRInTerminal: false,
    });

    this.socket.ev.on("connection.update", (update: any) => {
      (async () => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
          this.qr = qr;
          this.status = "disconnected";
        }

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const errorMessage = (lastDisconnect?.error as any)?.message || "";
          
          const isTimeout = statusCode === 408;
          const isQRError = errorMessage.includes("QR refs attempts ended");
          const isConnectionTerminated = statusCode === 428;
          
          const shouldReconnect = (statusCode !== DisconnectReason.loggedOut && statusCode !== DisconnectReason.badSession);
          
          this.status = "disconnected";
          this.qr = null;
          
          // Clear monitored group setting on major disconnects related to auth/session
          if (statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession) {
              this.monitoredGroupJid = null;
              await db.saveSetting("monitored_group_jid", "");
          }
          
          // Clear session if absolutely necessary
          if (statusCode === DisconnectReason.loggedOut || statusCode === DisconnectReason.badSession || isTimeout || isQRError || isConnectionTerminated) {
            console.warn(`WhatsApp: Force clearing session due to ${statusCode} (${errorMessage}).`);
            if (fs.existsSync("auth_info_baileys")) {
               try {
                   fs.rmSync("auth_info_baileys", { recursive: true, force: true });
               } catch (e) {
                   console.error("WhatsApp: Failed to clear session", e);
               }
            }
          }
          
          console.warn(`WhatsApp: Connection closed. Status Code: ${statusCode}. Should reconnect: ${shouldReconnect}`, lastDisconnect?.error);
          
          this.isInitializing = false; // Allow next attempt
          
          if (shouldReconnect) {
            if (this.reconnectionAttempts < this.MAX_RECONNECTION_ATTEMPTS) {
                this.reconnectionAttempts++;
                const delayMs = 30000; // Increased fixed delay for first reconnection or exponential
                console.log(`WhatsApp: Reconnecting in ${delayMs}ms (attempt ${this.reconnectionAttempts}/${this.MAX_RECONNECTION_ATTEMPTS})...`);
                await delay(delayMs);
                this.isInitializing = false;
                await this.init();
            } else {
                console.error("WhatsApp: Too many reconnection attempts. Stopping.");
                this.status = "disconnected";
            }
          }
        } else if (connection === "open") {
          this.status = "connected";
          this.qr = null;
          this.reconnectionAttempts = 0; // Reset counter on success
          this.isInitializing = false;
        }
      })();
    });

    this.socket.ev.on("creds.update", saveCreds);

    this.socket.ev.on("messages.upsert", async (m: any) => {
      const msg = m.messages[0];
      if (!msg.message) return;

      const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text;

      // Check if it's from the specified group
      if (this.monitoredGroupJid) {
        if (msg.key.remoteJid !== this.monitoredGroupJid) {
          return;
        }
      }

      if (!messageText) return;

      const messageRecord = await db.saveRawMessage({
        group_jid: msg.key.remoteJid,
        message_id: msg.key.id,
        sender: msg.key.participant || msg.key.remoteJid,
        body: messageText,
        timestamp: msg.messageTimestamp ? new Date(msg.messageTimestamp * 1000).toISOString() : new Date().toISOString(),
        processed: false
      });

      try {
        const events = parseWithRules(messageText);
        if (events && events.length > 0) {
            await this.saveParsedEvents(events, messageText, msg.key.remoteJid);
        } else {
            const parsedData = await parseMessage(messageText);
            if (parsedData.startDate || parsedData.location) {
                await this.saveParsedEvents([parsedData], messageText, msg.key.remoteJid);
            }
        }
        await db.markMessageProcessed(messageRecord.id);
      } catch (err: any) {
        console.error("Error processing message (detailed):", err?.message || err, err);
      }
    });

    this.isInitializing = false;
  }


  getStatus() {
    return { status: this.status, qr: this.qr, monitoredGroupJid: this.monitoredGroupJid };
  }

  async disconnect() {
    if (this.socket) {
      await this.socket.logout();
      this.status = "disconnected";
      this.qr = null;
    }
  }

  async setMonitoredGroup(jid: string) {
    this.monitoredGroupJid = jid;
    await db.saveSetting("monitored_group_jid", jid);
  }

  async getGroups() {
    if (this.status !== "connected") return [];
    const chats = await this.socket.groupFetchAllParticipating();
    return Object.values(chats).map((c: any) => ({ id: c.id, name: c.subject }));
  }

  async fetchAndParsePastMessages(jid: string, limit: number = 50) {
    if (this.status !== "connected") throw new Error("WhatsApp not connected");
    
    // Baileys does not support fetching past messages without a store.
    // For this implementation, we will log a warning.
    console.warn("Fetching past messages directly via Baileys without a store is not supported.");
    return { success: false, message: "Store not implemented. Cannot fetch past messages." };
  }

  async reprocessMessages() {
    const messages = await db.getPendingMessages();
    // console.log(`Reprocessing ${messages.length} messages...`);
    for (const msg of messages) {
      try {
        await delay(3000); 
        const events = parseWithRules(msg.body);
        if (events && events.length > 0) {
            await this.saveParsedEvents(events, msg.body, null);
        } else {
            const parsedData = await parseMessage(msg.body);
            if (parsedData.startDate || parsedData.location) {
                await this.saveParsedEvents([parsedData], msg.body, null);
            }
        }
        await db.markMessageProcessed(msg.id);
      } catch (err: any) {
        console.error(`Error reprocessing message ${msg.id}:`, err?.message || err, err);
      }
    }
    return { success: true, count: messages.length };
  }

  async processGroupMessages(jid: string) {
    const messages = await db.getPendingMessagesForGroup(jid);
    // console.log(`Processing ${messages.length} messages for group ${jid}...`);
    for (const msg of messages) {
      try {
        await delay(3000); 
        const events = parseWithRules(msg.body);
        if (events && events.length > 0) {
           await this.saveParsedEvents(events, msg.body, jid);
        } else {
            const parsedData = await parseMessage(msg.body);
            if (parsedData.startDate || parsedData.location) {
                await this.saveParsedEvents([parsedData], msg.body, jid);
            }
        }
        await db.markMessageProcessed(msg.id);
      } catch (err: any) {
        console.error(`Error processing group message ${msg.id}:`, err?.message || err, err);
      }
    }
    return { success: true, count: messages.length };
  }

  async getRecentMessages(limit = 5) {
    return await db.getRecentMessages(limit);
  }
}

export const whatsappService = new WhatsAppService();
