import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.argv[2] ?? "examples/generated-vault";
const count = Number(process.argv[3] ?? 1000);

await mkdir(root, { recursive: true });

for (let index = 0; index < count; index += 1) {
  const target = `Note ${(index + 1) % count}`;
  const body = `# Note ${index}\n\nGenerated note ${index}. Links to [[${target}]].\n\n#generated\n`;
  await writeFile(join(root, `Note ${index}.md`), body, "utf8");
}

console.log(`Generated ${count} notes in ${root}`);
