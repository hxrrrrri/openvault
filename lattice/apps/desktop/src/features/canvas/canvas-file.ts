// Obsidian-compatible .canvas file (JCS-flavored JSON). Schema reference:
// https://jsoncanvas.org/

import type { CanvasCard, CanvasConnection, CanvasGroup } from "@/stores/canvas-store";

export interface ObsidianCanvasFile {
  nodes: ObsidianCanvasNode[];
  edges: ObsidianCanvasEdge[];
}

export type ObsidianCanvasNode =
  | ObsidianTextNode
  | ObsidianFileNode
  | ObsidianLinkNode
  | ObsidianGroupNode;

interface BaseNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
}

export interface ObsidianTextNode extends BaseNode {
  type: "text";
  text: string;
}

export interface ObsidianFileNode extends BaseNode {
  type: "file";
  file: string;
  subpath?: string;
}

export interface ObsidianLinkNode extends BaseNode {
  type: "link";
  url: string;
}

export interface ObsidianGroupNode extends BaseNode {
  type: "group";
  label?: string;
  background?: string;
  backgroundStyle?: "cover" | "ratio" | "repeat";
}

export interface ObsidianCanvasEdge {
  id: string;
  fromNode: string;
  fromSide?: "top" | "right" | "bottom" | "left";
  toNode: string;
  toSide?: "top" | "right" | "bottom" | "left";
  color?: string;
  label?: string;
}

export function parseObsidianCanvas(raw: string): ObsidianCanvasFile {
  const data = JSON.parse(raw) as Partial<ObsidianCanvasFile>;
  return {
    nodes: Array.isArray(data.nodes) ? data.nodes : [],
    edges: Array.isArray(data.edges) ? data.edges : [],
  };
}

export function serializeObsidianCanvas(file: ObsidianCanvasFile): string {
  return JSON.stringify(file, null, 2);
}

// Conversion between LATTICE canvas model and Obsidian schema.

export interface LatticeCanvasSnapshot {
  cards: CanvasCard[];
  connections: CanvasConnection[];
  groups: CanvasGroup[];
}

export function obsidianToLattice(file: ObsidianCanvasFile): LatticeCanvasSnapshot {
  const cards: CanvasCard[] = [];
  const groups: CanvasGroup[] = [];
  for (const node of file.nodes) {
    if (node.type === "group") {
      groups.push({
        id: node.id,
        label: node.label ?? "Group",
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        color: node.color ?? node.background ?? "#8B7CFF",
      });
      continue;
    }
    if (node.type === "text") {
      cards.push({
        id: node.id,
        type: "text",
        title: firstLine(node.text) || "Card",
        body: node.text,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      });
      continue;
    }
    if (node.type === "file") {
      cards.push({
        id: node.id,
        type: "note",
        title: node.file.split("/").pop()?.replace(/\.md$/i, "") ?? node.file,
        body: "",
        path: node.file,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      });
      continue;
    }
    if (node.type === "link") {
      cards.push({
        id: node.id,
        type: "web",
        title: node.url,
        body: "",
        url: node.url,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      });
      continue;
    }
  }
  const connections: CanvasConnection[] = file.edges.map((edge) => ({
    id: edge.id,
    sourceId: edge.fromNode,
    targetId: edge.toNode,
    color: edge.color ?? "#8B7CFF",
  }));
  return { cards, connections, groups };
}

export function latticeToObsidian(snapshot: LatticeCanvasSnapshot): ObsidianCanvasFile {
  const nodes: ObsidianCanvasNode[] = [];
  for (const group of snapshot.groups) {
    nodes.push({
      id: group.id,
      type: "group",
      x: group.x,
      y: group.y,
      width: group.width,
      height: group.height,
      label: group.label,
      color: group.color,
    });
  }
  for (const card of snapshot.cards) {
    if (card.type === "note" && card.path) {
      nodes.push({
        id: card.id,
        type: "file",
        x: card.x,
        y: card.y,
        width: card.width,
        height: card.height,
        file: card.path,
      });
    } else if (card.type === "web" && card.url) {
      nodes.push({
        id: card.id,
        type: "link",
        x: card.x,
        y: card.y,
        width: card.width,
        height: card.height,
        url: card.url,
      });
    } else {
      nodes.push({
        id: card.id,
        type: "text",
        x: card.x,
        y: card.y,
        width: card.width,
        height: card.height,
        text: card.body || card.title,
      });
    }
  }
  const edges: ObsidianCanvasEdge[] = snapshot.connections.map((connection) => ({
    id: connection.id,
    fromNode: connection.sourceId,
    toNode: connection.targetId,
    color: connection.color,
  }));
  return { nodes, edges };
}

function firstLine(text: string): string {
  const line = text.split("\n").find((l) => l.trim());
  return line?.trim() ?? "";
}
