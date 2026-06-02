import { describe, expect, it } from "vitest";
import { mockInvoke } from "@/lib/browser-mock";
import { commands } from "@/lib/commands";

describe("browser mock command provider", () => {
  it("returns a deterministic vault for state queries", async () => {
    const info = await mockInvoke<{ noteCount: number; name: string }>("get_vault_state");
    expect(info.noteCount).toBeGreaterThan(0);
    expect(info.name).toContain("preview");
  });

  it("reports a completed, non-stale index", async () => {
    const status = await mockInvoke<{ phase: string; stale: boolean }>("get_indexing_status");
    expect(status.phase).toBe("completed");
    expect(status.stale).toBe(false);
  });

  it("builds a graph with resolvable wikilink edges", async () => {
    const graph = await mockInvoke<{ nodes: unknown[]; edges: unknown[] }>("get_global_graph");
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it("search finds seeded content and reflects mutations", async () => {
    const before = await mockInvoke<unknown[]>("search", { query: "permission" });
    expect(before.length).toBeGreaterThan(0);

    await mockInvoke("create_note", { path: "Search Target.md", content: "# Target\n\nzzunique token" });
    const found = await mockInvoke<Array<{ path: string }>>("search", { query: "zzunique" });
    expect(found.some((r) => r.path === "Search Target.md")).toBe(true);

    await mockInvoke("delete_note", { path: "Search Target.md" });
    const afterDelete = await mockInvoke<unknown[]>("search", { query: "zzunique" });
    expect(afterDelete).toHaveLength(0);
  });

  it("unknown commands resolve to null instead of throwing", async () => {
    await expect(mockInvoke("totally_unknown_command")).resolves.toBeNull();
  });
});

describe("command wrappers route through safeInvoke", () => {
  it("getIndexingStatus resolves in browser mode", async () => {
    const status = await commands.getIndexingStatus();
    expect(status.phase).toBe("completed");
  });

  it("listFiles returns the in-memory tree in browser mode", async () => {
    const files = await commands.listFiles();
    expect(Array.isArray(files)).toBe(true);
    expect(files.length).toBeGreaterThan(0);
  });
});
