import { describe, expect, it } from "vitest";
import { commands } from "@/lib/commands";

/**
 * Integration "user journey" exercised through the command layer (routed to the
 * deterministic browser-mock backend in this environment). This mirrors the
 * end-to-end flow in `tests/e2e/` without requiring a packaged desktop binary:
 * open vault -> create note -> add wikilink -> graph updates -> search finds it
 * -> backlink resolves.
 */
describe("core user journey", () => {
  it("create note + wikilink shows up in graph, search, and backlinks", async () => {
    // 1. Vault is open.
    const vault = await commands.getVaultState();
    expect(vault.noteCount).toBeGreaterThan(0);

    // 2. Create a note that links to an existing one.
    await commands.createNote("Project Plan.md", "# Project Plan\n\nDepends on [[Welcome]]. #project");

    // 3. Graph contains the new node and an edge to Welcome.
    const graph = await commands.getGlobalGraph();
    expect(graph.nodes.some((n) => n.path === "Project Plan.md")).toBe(true);
    expect(
      graph.edges.some((e) => e.source === "Project Plan.md" && e.target === "Welcome.md"),
    ).toBe(true);

    // 4. Search finds the new note by content.
    const results = await commands.search("Project Plan");
    expect(results.some((r) => r.path === "Project Plan.md")).toBe(true);

    // 5. Welcome now has a backlink from the new note.
    const backlinks = await commands.getBacklinks("Welcome.md");
    expect(backlinks.some((b) => b.sourcePath === "Project Plan.md")).toBe(true);

    // Cleanup so the shared in-memory store stays deterministic across files.
    await commands.deleteNote("Project Plan.md");
  });
});
