import express from "express";
import { whatsappService } from "../services/whatsappService.js";

const router = express.Router();

router.get("/status", (req, res) => {
  res.json(whatsappService.getStatus());
});

router.get("/groups", async (req, res) => {
  try {
    const groups = await whatsappService.getGroups();
    res.json(groups);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/disconnect", async (req, res) => {
  await whatsappService.disconnect();
  res.json({ success: true });
});

router.post("/set-group", async (req, res) => {
  const { jid } = req.body;
  await whatsappService.setMonitoredGroup(jid);
  res.json({ success: true });
});

router.post("/fetch-past-messages", async (req, res) => {
    const { jid, limit } = req.body;
    const result = await whatsappService.fetchAndParsePastMessages(jid, limit);
    res.json(result);
});

router.post("/reprocess-messages", async (req, res) => {
    const result = await whatsappService.reprocessMessages();
    res.json(result);
});

router.post("/process-group-messages", async (req, res) => {
    const { jid } = req.body;
    const result = await whatsappService.processGroupMessages(jid);
    res.json(result);
});

router.get("/recent-messages", async (req, res) => {
    const { limit } = req.query;
    const result = await whatsappService.getRecentMessages(parseInt(limit as string) || 5);
    res.json(result);
});

export default router;
