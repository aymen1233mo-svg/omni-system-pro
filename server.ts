import app from "./artifacts/api-server/src/app";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const _dirname = typeof __dirname !== "undefined" ? __dirname : process.cwd();

const DEFAULT_PORT = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : (process.env.ELECTRON_WORKER_PORT
    ? parseInt(process.env.ELECTRON_WORKER_PORT, 10)
    : 3000);

let staticMounted = false;

export async function startServer(portOverride?: number) {
  const PORT = portOverride || DEFAULT_PORT;

  if (process.env.NODE_ENV !== "production") {
    if (!staticMounted) {
      staticMounted = true;
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true, hmr: false },
        appType: "spa",
        configFile: path.resolve(process.cwd(), "vite.config.ts")
      });
      app.use(vite.middlewares);
    }
  } else if (!staticMounted) {
    staticMounted = true;
    // التحقق من كافة المسارات المحتملة لحزمة الواجهة المجمعة
    const candidates = [
      process.env.APP_ROOT ? path.resolve(process.env.APP_ROOT, "dist", "public") : "",
      process.env.APP_ROOT ? path.resolve(process.env.APP_ROOT, "dist") : "",
      process.env.APP_ROOT ? path.resolve(process.env.APP_ROOT, "artifacts/pos-system/dist/public") : "",
      process.env.APP_ROOT ? path.resolve(process.env.APP_ROOT, "artifacts/pos-system/dist") : "",
      (process as any).resourcesPath ? path.join((process as any).resourcesPath, "app.asar.unpacked", "dist", "public") : "",
      (process as any).resourcesPath ? path.join((process as any).resourcesPath, "app", "dist", "public") : "",
      (process as any).resourcesPath ? path.join((process as any).resourcesPath, "app", "dist") : "",
      (process as any).resourcesPath ? path.join((process as any).resourcesPath, "dist", "public") : "",
      (process as any).resourcesPath ? path.join((process as any).resourcesPath, "dist") : "",
      path.resolve(_dirname, "public"),
      path.resolve(_dirname), // في حال تشغيل dist/server.cjs يكون _dirname هو مجلد dist نفسه
      path.resolve(_dirname, "dist", "public"),
      path.resolve(_dirname, "dist"),
      path.resolve(_dirname, "../dist/public"),
      path.resolve(_dirname, "../dist"),
      path.resolve(_dirname, "../../dist/public"),
      path.resolve(_dirname, "../../dist"),
      path.resolve(process.cwd(), "dist/public"),
      path.resolve(process.cwd(), "dist"),
      path.resolve(process.cwd(), "artifacts/pos-system/dist/public"),
      path.resolve(process.cwd(), "artifacts/pos-system/dist")
    ].filter(Boolean) as string[];
    
    const distPath = candidates.find((p) => fs.existsSync(path.join(p, "index.html"))) || candidates[0];
    process.env.FRONTEND_DIST = distPath;
    
    console.log(`✅ Frontend static files served from: ${distPath}`);
    
    app.use(express.static(distPath));
    app.use(express.static(path.resolve(process.cwd(), "public")));
    
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        res.status(404).json({ error: `API route not found: ${req.path}` });
        return;
      }
      res.sendFile(path.join(distPath, "index.html"), (err) => {
        if (err) next(err);
      });
    });
  }

  return new Promise((resolve, reject) => {
    const HOST = process.env.HOST || "0.0.0.0";
    const server = app.listen(PORT, HOST, () => {
      const actualPort = typeof server.address() === "object" && server.address() !== null ? (server.address() as any).port : PORT;
      console.log(`🚀 Omni System Pro ERP Server running on http://${HOST}:${actualPort}`);
      resolve({ server, port: actualPort });
    });
    server.on("error", (err) => {
      console.error(`Failed to start server on port ${PORT}:`, err);
      reject(err);
    });

    const gracefulShutdown = () => {
      console.log('Received kill signal, shutting down gracefully');
      server.close(() => {
        console.log('Closed out remaining connections');
        process.exit(0);
      });
      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  });
}

if (process.env.NO_SERVER_AUTOSTART !== "true") {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}

export default app;