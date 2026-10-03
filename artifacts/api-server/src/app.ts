import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { db } from "./lib/sqlite";
import { runErpAccountingSync } from "./lib/erp-accounting-sync";

try {
  runErpAccountingSync(db);
} catch (err) {
  console.error("Initial ERP Accounting Sync error:", err);
}

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", router);

// Error fallback for unmatched /api routes to prevent HTML response
app.use("/api", (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl || req.url}` });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(err);
  if (req.path.startsWith("/api")) {
    res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
  } else {
    next(err);
  }
});

// Standalone production static file serving if FRONTEND_DIST is explicitly provided
if (process.env.FRONTEND_DIST) {
  const distPath = path.resolve(process.env.FRONTEND_DIST);
  if (fs.existsSync(path.join(distPath, "index.html"))) {
    app.use(express.static(distPath));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.sendFile(path.join(distPath, "index.html"), (err) => {
        if (err) next(err);
      });
    });
  }
}

export default app;
