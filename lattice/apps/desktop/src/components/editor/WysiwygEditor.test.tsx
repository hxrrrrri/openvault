import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WysiwygEditor } from "@/components/editor/WysiwygEditor";

vi.mock("@/lib/commands", () => ({
  commands: {
    readAssetDataUrl: vi.fn(),
  },
}));

describe("WysiwygEditor", () => {
  it("mounts markdown content without crashing", () => {
    render(
      <WysiwygEditor
        value={"# Hello\n\nThis is a note."}
        onChange={vi.fn()}
        placeholder="Write"
      />,
    );

    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("This is a note.")).toBeInTheDocument();
  });
});
