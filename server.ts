import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "operational", version: "4.3.0-PREMIUM_ORCHESTRATOR" });
  });

  // Mock subscription endpoint
  app.post("/api/subscription/trial", (req, res) => {
    // In a real app, this would register a trial in a database linked to the user
    res.json({ 
      status: "trial_started", 
      trial_end: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      plan: "High-Frequency Executive"
    });
  });

  // Feedback endpoint
  app.post("/api/feedback", (req, res) => {
    const { feedback, userId } = req.body;
    console.log(`[ELITE_FEEDBACK] User ${userId || 'anonymous'} sent: ${feedback}`);
    res.json({ status: "success", message: "Feedback received at HQ." });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ELITE_EXECUTION] System running at http://localhost:${PORT}`);
  });
}

startServer();
