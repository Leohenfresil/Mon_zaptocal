import express from "express";
import { getAuthUrl, handleCallback } from "../services/calendlyService.js";
import { db } from "../services/supabaseService.js";

const router = express.Router();

router.get("/auth", async (req, res) => {
  const url = await getAuthUrl();
  res.redirect(url);
});

router.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send("No code provided");
  
  try {
    await handleCallback(code as string);
    res.send("Calendly Authenticated! You can close this window.");
  } catch (err: any) {
    res.status(500).send("Auth failed: " + err.message);
  }
});

router.get("/status", async (req, res) => {
  const tokens = await db.getSettings("calendly_tokens");
  res.json({ authenticated: !!tokens });
});

export default router;
