import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const workerPath = resolve("dist/server/index.js");
const worker = readFileSync(workerPath, "utf8");

if (worker.includes("__AUTOFORGE_PAGE__")) {
  throw new Error("Worker page was not embedded.");
}
if (!worker.includes("batch_sessions") || !worker.includes("packet_records")) {
  throw new Error("Backend data routes are missing.");
}

const module = await import(pathToFileURL(workerPath).href + "?verify=" + Date.now());
if (!module.default || typeof module.default.fetch !== "function") {
  throw new Error("Worker default fetch handler is missing.");
}

console.log("Backend worker artifact OK.");
