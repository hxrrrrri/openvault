import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "@/components/command-palette/CommandPalette";

describe("CommandPalette", () => {
  it("renders command search input", () => {
    render(<CommandPalette onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText(/search notes/i)).toBeInTheDocument();
  });
});
