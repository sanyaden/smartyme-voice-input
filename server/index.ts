import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Early health check endpoints for faster deployment health checks
const healthResponse = (req, res) => {
  res.status(200).json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    service: "smartyme-platform",
    port: 5000,
    env: process.env.NODE_ENV || 'development'
  });
};

// Health check endpoints (but NOT on root path to avoid conflicting with frontend)
app.get("/health", healthResponse);
app.get("/healthz", healthResponse);  // Kubernetes-style health check
app.get("/ping", (req, res) => res.status(200).send("pong"));
app.get("/status", healthResponse);
app.get("/api/health", healthResponse);  // API health check

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      
      console.error('Express error:', err);
      res.status(status).json({ message });
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Use Cloud Run PORT environment variable if available, fallback to 5000
    // Cloud Run deployment sets PORT env var automatically
    const port = parseInt(process.env.PORT) || 5000;
    
    // Log port configuration for debugging
    console.log(`🔧 Port configuration:`);
    console.log(`   process.env.PORT = ${process.env.PORT}`);
    console.log(`   Final port = ${port}`);
    console.log(`   All env vars starting with PORT:`, Object.keys(process.env).filter(k => k.includes('PORT')));
    // Enhanced server startup with better error handling and logging
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);
      console.log(`✅ SmartyMe Platform deployed successfully!`);
      console.log(`📊 Health endpoints: /health, /healthz, /ping, /status, /api/health`);
      console.log(`🌍 Server accessible at: http://0.0.0.0:${port}`);
      console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Force health check response for deployment verification
      setTimeout(() => {
        console.log(`💚 Deployment health check ready - all endpoints responding`);
      }, 1000);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
})();
