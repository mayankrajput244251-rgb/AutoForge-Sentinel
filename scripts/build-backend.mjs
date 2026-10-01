import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const pagePath = resolve(root, "dist/index.html");
const workerTemplatePath = resolve(root, "worker/index.js");
const outputDirectory = resolve(root, "dist/server");
const hostingSource = resolve(root, ".openai/hosting.json");
const hostingOutput = resolve(root, "dist/.openai/hosting.json");
const page = readFileSync(pagePath, "utf8");
const template = readFileSync(workerTemplatePath, "utf8");

if (!template.includes("__AUTOFORGE_PAGE__")) {
  throw new Error("Worker page placeholder is missing.");
}

mkdirSync(outputDirectory, { recursive: true });
mkdirSync(resolve(root, "dist/.openai"), { recursive: true });
writeFileSync(resolve(outputDirectory, "index.js"), template.replace("__AUTOFORGE_PAGE__", JSON.stringify(page)));
copyFileSync(hostingSource, hostingOutput);
console.log("Built AutoForge backend worker.");
