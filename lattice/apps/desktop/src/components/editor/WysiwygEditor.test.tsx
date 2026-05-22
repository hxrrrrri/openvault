import { render, screen, waitFor } from "@testing-library/react";
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

  it("renders inserted embeds and task markdown as interactive components", async () => {
    const { container } = render(
      <WysiwygEditor
        value={`<iframe src="https://www.youtube.com/embed/abc123" width="100%" height="380" allowfullscreen></iframe>

<video controls src="https://example.com/clip.mp4"></video>

<audio controls src="https://example.com/song.mp3"></audio>

- [ ] New task`}
        onChange={vi.fn()}
        placeholder="Write"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("YouTube")).toBeInTheDocument();
      expect(screen.getByText("Video")).toBeInTheDocument();
      expect(screen.getByText("Audio")).toBeInTheDocument();
    });
    expect(container.querySelector('iframe[src="https://www.youtube.com/embed/abc123"]')).toBeTruthy();
    expect(container.querySelector('video[src="https://example.com/clip.mp4"]')).toBeTruthy();
    expect(container.querySelector('audio[src="https://example.com/song.mp3"]')).toBeTruthy();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getAllByLabelText("Delete block").length).toBeGreaterThanOrEqual(3);
  });
});
