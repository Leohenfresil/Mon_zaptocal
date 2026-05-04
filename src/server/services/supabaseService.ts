import { createClient } from '@supabase/supabase-js';
import dotenv from "dotenv";

dotenv.config();

// ── Cliente Supabase ───────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "" // service key para operações server-side
);

export default supabase;

// ── Funções de acesso ao banco ─────────────────────────────

export const db = {
  // GRUPOS
  async getActiveGroups() {
    const { data, error } = await supabase
      .from('whatsapp_groups')
      .select('*')
      .eq('is_active', true);
    if (error) throw error;
    return data;
  },

  async upsertGroup({ group_jid, group_name }: { group_jid: string, group_name: string }) {
    const { data, error } = await supabase
      .from('whatsapp_groups')
      .upsert({ group_jid, group_name }, { onConflict: 'group_jid' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // MENSAGENS BRUTAS
  async saveRawMessage({ group_jid, message_id, sender, body, timestamp }: any) {
    const { data, error } = await supabase
      .from('raw_messages')
      .upsert(
        { group_jid, message_id, sender, body, timestamp },
        { onConflict: 'message_id', ignoreDuplicates: true }
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getPendingMessages() {
    const { data, error } = await supabase
      .from('raw_messages')
      .select('*')
      .eq('processed', false)
      .order('timestamp', { ascending: true })
      .limit(50);
    if (error) throw error;
    return data;
  },

  async getRecentMessages(limit = 5) {
    const { data, error } = await supabase
      .from('raw_messages')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  async getPendingMessagesForGroup(group_jid: string) {
    const { data, error } = await supabase
      .from('raw_messages')
      .select('*')
      .eq('processed', false)
      .eq('group_jid', group_jid)
      .order('timestamp', { ascending: true });
    if (error) throw error;
    return data;
  },

  async markMessageProcessed(id: string) {
    const { error } = await supabase
      .from('raw_messages')
      .update({ processed: true })
      .eq('id', id);
    if (error) throw error;
  },

  // EVENTOS
  async createEvent(eventData: any) {
    if (eventData.tags) {
        if (typeof eventData.tags === 'string') {
            eventData.tags = eventData.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== "");
        } else if (!Array.isArray(eventData.tags)) {
            eventData.tags = [String(eventData.tags)];
        } else {
            eventData.tags = eventData.tags.map(tag => String(tag).trim()).filter(tag => tag !== "");
        }
    }
    const { data, error } = await supabase
      .from('events')
      .insert({ ...eventData, status: eventData.status || 'pending' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async saveEvent(eventData: any) {
    if (eventData.tags) {
        if (typeof eventData.tags === 'string') {
            eventData.tags = eventData.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== "");
        } else if (!Array.isArray(eventData.tags)) {
            eventData.tags = [String(eventData.tags)];
        } else {
            eventData.tags = eventData.tags.map(tag => String(tag).trim()).filter(tag => tag !== "");
        }
    }
    const { data, error } = await supabase
      .from('events')
      .insert(eventData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async findEvent(eventData: any) {
    const { data, error } = await supabase
      .from('events')
      .select('id')
      .eq('event_date', eventData.event_date)
      .eq('title', eventData.title)
      .eq('start_time', eventData.start_time)
      .eq('client', eventData.client)
      .eq('group_jid', eventData.group_jid)
      .maybeSingle();
    if (error) return null;
    return data;
  },

  async getEvents({ startDate, endDate, status, client, location } : any = {}) {
    let query = supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: true });

    if (startDate) query = query.gte('event_date', startDate);
    if (endDate) query = query.lte('event_date', endDate);
    if (status) {
      if (Array.isArray(status)) {
        query = query.in('status', status);
      } else {
        query = query.eq('status', status);
      }
    }
    if (client) query = query.ilike('client', `%${client}%`);
    if (location) query = query.ilike('location', `%${location}%`);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getEventById(id: string) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getDashboardStats() {
    const [messages, events, pending, confirmed] = await Promise.all([
      supabase.from('raw_messages').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
    ]);
    
    return {
      totalMessages: messages.count || 0,
      totalEvents: events.count || 0,
      pendingEvents: pending.count || 0,
      confirmedEvents: confirmed.count || 0,
    };
  },

  async updateEvent(id: string, updates: any) {
    const event = await this.getEventById(id);
    
    // Logic: If status is 'confirmed' (sincronizado) and it's being updated, set to 'pending'
    let finalUpdates = { ...updates, updated_at: new Date().toISOString() };
    
    // Ensure tags are an array of strings for the text[] column
    if (finalUpdates.tags) {
        if (typeof finalUpdates.tags === 'string') {
            finalUpdates.tags = finalUpdates.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== "");
        } else if (!Array.isArray(finalUpdates.tags)) {
            finalUpdates.tags = [String(finalUpdates.tags)];
        } else {
            // It is an array, trim strings if needed
            finalUpdates.tags = finalUpdates.tags.map(tag => String(tag).trim()).filter(tag => tag !== "");
        }
    }
    
    const { data, error } = await supabase
      .from('events')
      .update(finalUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteEvent(id: string) {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { success: true };
  },

  async getUnsyncedEvents() {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .is('google_event_id', null)
      .eq('status', 'confirmed')
      .order('event_date', { ascending: true });
    if (error) throw error;
    return data;
  },

  // TOKENS GOOGLE
  async saveGoogleTokens({ user_id, access_token, refresh_token, token_expiry, calendar_id }: any) {
    const { data, error } = await supabase
      .from('google_tokens')
      .upsert(
        { user_id, access_token, refresh_token, token_expiry, calendar_id, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getGoogleTokens(user_id = 'default') {
    const { data, error } = await supabase
      .from('google_tokens')
      .select('*')
      .eq('user_id', user_id)
      .single();
    if (error) return null;
    return data;
  },

  // SETTINGS
  async getSettings(key: string) {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data?.value;
  },

  async saveSetting(key: string, value: any) {
    const { data, error } = await supabase
      .from('settings')
      .upsert({ key, value }, { onConflict: 'key' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
