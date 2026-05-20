import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FileTree } from "@/components/layout/FileTree";
import { useVaultStore } from "@/stores/vault-store";
import type { FileNode } from "@/types/domain";

const files: FileNode[] = [
  {
    id: "research",
    path: "Research",
    name: "Research",
    kind: "folder",
    children: [{ id: "a", path: "Research/A.md", name: "A.md", kind: "file", isMarkdown: true }],
  },
];

describe("FileTree", () => {
  it("renders folders from vault state", () => {
    useVaultStore.setState({ files });
    render(<div style={{ height: 400 }}><FileTree /></div>);
    expect(screen.getByText("Research")).toBeInTheDocument();
  });
});
