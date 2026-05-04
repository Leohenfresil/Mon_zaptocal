import express from "express";
import whatsappRoutes from "./src/server/routes/whatsappRoutes.ts";
import eventRoutes from "./src/server/routes/eventRoutes.ts";
import calendarRoutes from "./src/server/routes/calendarRoutes.ts";
import { whatsappService } from "./src/server/services/whatsappService.ts";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// Initialize WhatsApp
whatsappService.init().catch(err => console.error("WhatsApp Init Error:", err));

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/whatsapp", whatsappRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/calendar", calendarRoutes);

export default app;
