import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import whatsappRoutes from "./src/server/routes/whatsappRoutes.js";
import eventRoutes from "./src/server/routes/eventRoutes.js";
import calendarRoutes from "./src/server/routes/calendarRoutes.js";
import { whatsappService } from "./src/server/services/whatsappService.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize WhatsApp
  whatsappService.init().catch(err => {
      console.error("WhatsApp Init Error (critical):", err);
      // Optional: If error is fatal for auth, you might want a delay or retry mechanism here.
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/whatsapp", whatsappRoutes);
  app.use("/api/events", eventRoutes);
  app.use("/api/calendar", calendarRoutes);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Add SPA fallback for dev
    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // app.listen(PORT, "0.0.0.0", () => {
  //   console.log(`Server running on http://0.0.0.0:${PORT}`);
  // });
  app.listen(PORT, "0.0.0.0");
}

startServer().catch((err) => {
  console.error("Failed to start server", err);
  process.exit(1);
});
