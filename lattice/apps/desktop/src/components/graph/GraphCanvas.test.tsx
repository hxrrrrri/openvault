import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GraphCanvas } from "@/components/graph/GraphCanvas";
import type { GraphPayload } from "@/types/domain";

const graph: GraphPayload = {
  nodes: [
    {
      id: "A.md",
      path: "A.md",
      title: "A",
      type: "note",
      tags: ["#test"],
      degree: 1,
      isOrphan: false,
      isActive: true,
      lastModified: new Date().toISOString(),
      x: 0,
      y: 0,
    },
  ],
  edges: [],
};

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

Object.defineProperty(window, "ResizeObserver", {
  value: ResizeObserverMock,
});

HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  quadraticCurveTo: vi.fn(),
  stroke: vi.fn(),
  setLineDash: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  measureText: vi.fn(() => ({ width: 50 })),
  fillText: vi.fn(),
})) as never;

describe("GraphCanvas", () => {
  it("renders a canvas", () => {
    const { container } = render(
      <div style={{ width: 800, height: 600 }}>
        <GraphCanvas
          graph={graph}
          selectedId={graph.nodes[0].id}
          hoveredId={null}
          filters={{ includeOrphans: true }}
          labelMode="auto"
          onSelect={vi.fn()}
          onHover={vi.fn()}
          onOpenNode={vi.fn()}
        />
      </div>,
    );
    expect(container.querySelector("canvas")).toBeTruthy();
  });
});
