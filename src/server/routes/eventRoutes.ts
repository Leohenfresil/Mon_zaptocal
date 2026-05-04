import express from "express";
import { db } from "../services/supabaseService.ts";
import { createCalendlyEvent } from "../services/calendlyService.ts";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const events = await db.getEvents(req.query);
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const stats = await db.getDashboardStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const event = await db.createEvent(req.body);
    res.json(event);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const event = await db.updateEvent(req.params.id, req.body);
    res.json(event);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await db.deleteEvent(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/sync-bulk", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: "Invalid ids" });
    
    const results = [];
    for (const id of ids) {
      const event = await db.getEventById(id);
      if (event && event.status === "pending" && !event.google_event_id) {
        const calendlyResult = await createCalendlyEvent(event);
        await db.updateEvent(id, { 
          status: "confirmed", 
          google_event_id: calendlyResult.id 
        });
        results.push({ id, success: true });
      }
    }

    res.json({ success: true, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/sync", async (req, res) => {
  try {
    const event = await db.getEventById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const calendlyResult = await createCalendlyEvent(event);
    await db.updateEvent(req.params.id, { 
      status: "confirmed", 
      google_event_id: calendlyResult.id 
    });

    res.json({ success: true, calendlyResult });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
