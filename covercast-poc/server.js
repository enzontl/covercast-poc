import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import analyzeHandler from "./api/analyze.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split("?")[0];

  if (urlPath === "/api/analyze") {
    let rawBody = "";
    req.on("data", (chunk) => {
      rawBody += chunk;
    });
    req.on("end", async () => {
      req.body = rawBody ? JSON.parse(rawBody) : {};
      const resAdapter = {
        statusCode: 200,
        headers: {},
        setHeader(k, v) {
          this.headers[k] = v;
        },
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(obj) {
          res.writeHead(this.statusCode, {
            ...this.headers,
            "Content-Type": "application/json; charset=utf-8"
          });
          res.end(JSON.stringify(obj));
        },
        end() {
          res.writeHead(this.statusCode, this.headers);
          res.end();
        }
      };
      await analyzeHandler(req, resAdapter);
    });
    return;
  }

  const safePath = urlPath === "/" ? "/index.html" : urlPath;
  const fullPath = path.join(__dirname, path.normalize(safePath));

  if (!fullPath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`CoverCast PoC running at http://localhost:${PORT}`);
});
