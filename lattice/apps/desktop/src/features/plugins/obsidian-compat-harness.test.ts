import { describe, expect, it } from "vitest";
import { runObsidianCompatibilityHarness, TOP_PLUGIN_COMPATIBILITY_FIXTURES } from "@/features/plugins/obsidian-compat-harness";

describe("Obsidian compatibility harness", () => {
  it("loads representative top-plugin API patterns and reports compatibility", async () => {
    const results = await runObsidianCompatibilityHarness();

    expect(results).toHaveLength(TOP_PLUGIN_COMPATIBILITY_FIXTURES.length);
    expect(results.some((result) => result.status === "failed")).toBe(false);
    expect(results.find((result) => result.id === "calendar-like")).toMatchObject({
      status: "functional",
      commands: 1,
      ribbonItems: 1,
      statusItems: 1,
      settingTabs: 1,
    });
    expect(results.find((result) => result.id === "dataview-like")?.markdownProcessors).toBe(2);
    expect(results.find((result) => result.id === "kanban-like")?.unsupportedApis).toContain("Plugin.registerView");
    expect(results.find((result) => result.id === "excalidraw-like")?.unsupportedApis).toEqual(
      expect.arrayContaining(["Plugin.registerEditorExtension", "Plugin.registerEditorSuggest"]),
    );
  });
});
