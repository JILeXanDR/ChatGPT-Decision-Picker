import { readFile, writeFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const htmlPath = resolve(dist, "widget/index.html");
let html = await readFile(htmlPath, "utf8");

const assetPath = (ref) => ref.startsWith("/")
  ? resolve(dist, ref.slice(1))
  : resolve(dirname(htmlPath), ref);

for (const match of [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/g)]) {
  const css = await readFile(assetPath(match[1]), "utf8");
  html = html.replace(match[0], `<style>${css.replaceAll("</style", "<\\/style")}</style>`);
}

for (const match of [...html.matchAll(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["'][^>]*><\/script>/g)]) {
  const js = await readFile(assetPath(match[1]), "utf8");
  html = html.replace(match[0], `<script type="module">${js.replaceAll("</script", "<\\/script")}</script>`);
}

await writeFile(htmlPath, html);
await rm(resolve(dist, "assets"), { recursive: true, force: true });
console.log(`Inlined widget: ${htmlPath}`);
