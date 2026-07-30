#!/usr/bin/env node
/**
 * API server for the nginx deployment.
 *
 * The handlers in api/ are written against Vercel's request/response shape
 * (res.status().json(), res.setHeader(), req.body). This wraps plain Node
 * http so those handlers run unchanged -- no rewrite, no Express, no
 * dependencies. Requires Node 18+ (api/chat.js uses global fetch).
 *
 * nginx proxies /api/* here; it serves everything else as static files.
 *
 * Usage:  node api-server.js            (PORT=3001 by default)
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || "127.0.0.1";
const MAX_BODY = 1024 * 1024; // 1 MB

/* ---- .env loader (systemd EnvironmentFile does this too; this is for local runs) ---- */
function loadEnv() {
  const file = path.join(__dirname, ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i);
    if (!m) continue;
    const key = m[1];
    if (process.env[key] !== undefined) continue; // real env wins
    process.env[key] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
loadEnv();

/* ---- explicit route table: no dynamic require, no path traversal ---- */
const ROUTES = {
  "/api/chat": require("./api/chat"),
  "/api/book": require("./api/book"),
  "/api/availability": require("./api/availability"),
};

/* ---- Vercel-compatible response helpers ---- */
function decorate(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => {
    const payload = JSON.stringify(obj);
    if (!res.headersSent) res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(payload);
    return res;
  };
  return res;
}

/**
 * Handlers call readBody(req) themselves, but they short-circuit on req.body
 * if it is already set. Buffering here means a handler never races the stream.
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
      return resolve(undefined);
    }
    let raw = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        req.destroy();
        return reject(new Error("body_too_large"));
      }
      raw += chunk;
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  decorate(res);

  const pathname = (req.url || "/").split("?")[0].replace(/\/+$/, "") || "/";

  // health check for systemd / uptime monitoring
  if (pathname === "/health") {
    return res.status(200).json({ ok: true, ai: Boolean(process.env.ANTHROPIC_API_KEY) });
  }

  const handler = ROUTES[pathname];
  if (!handler) return res.status(404).json({ error: "not_found" });

  try {
    const raw = await readBody(req);
    if (raw !== undefined) req.body = raw; // handlers parse it themselves
    await handler(req, res);
  } catch (err) {
    const tooLarge = err && err.message === "body_too_large";
    console.error(`[api] ${req.method} ${pathname}:`, err && err.message);
    if (!res.writableEnded) {
      res.status(tooLarge ? 413 : 500).json({ error: tooLarge ? "body_too_large" : "server_error" });
    }
  }
});

server.listen(PORT, HOST, () => {
  const mode = process.env.ANTHROPIC_API_KEY ? "Claude tool-use" : "scripted fallback (no ANTHROPIC_API_KEY)";
  console.log(`[api] listening on http://${HOST}:${PORT}  —  booking assistant: ${mode}`);
});

for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    console.log(`[api] ${sig} — shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
