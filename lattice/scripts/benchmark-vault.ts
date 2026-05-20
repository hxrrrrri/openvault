import { performance } from "node:perf_hooks";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.argv[2] ?? ".bench-vault";
const count = Number(process.argv[3] ?? 1000);

await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });

let start = performance.now();
for (let index = 0; index < count; index += 1) {
  await writeFile(join(root, `Note ${index}.md`), `# Note ${index}\n\nLinks [[Note ${(index + 1) % count}]]. #bench\n`, "utf8");
}
const generateMs = performance.now() - start;

start = performance.now();
for (let index = 0; index < count; index += 1) {
  await readFile(join(root, `Note ${index}.md`), "utf8");
}
const readMs = performance.now() - start;

console.table({
  notes: count,
  generateMs: Math.round(generateMs),
  readMs: Math.round(readMs),
  avgReadMs: Number((readMs / count).toFixed(3)),
});
