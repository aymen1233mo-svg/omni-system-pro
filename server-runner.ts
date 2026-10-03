import { spawn } from "node:child_process";

console.log("🚀 Starting Restaurant POS Full-Stack Application...");

// 1. Start the Express API Server on port 5001
const apiServer = spawn("npx", ["tsx", "artifacts/api-server/src/index.ts"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: "5001",
    NODE_ENV: "development",
  },
  shell: true,
});

// 2. Start the Vite POS client on port 3000 (which proxies /api requests to port 8080)
const clientDev = spawn("npx", ["vite", "--config", "artifacts/pos-system/vite.config.ts", "--host", "0.0.0.0"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: "3000",
    NODE_ENV: "development",
  },
  shell: true,
});

// Coordinate termination of child processes
const cleanup = () => {
  console.log("\n👋 Stopping development servers...");
  try {
    apiServer.kill();
  } catch (e) {}
  try {
    clientDev.kill();
  } catch (e) {}
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);
