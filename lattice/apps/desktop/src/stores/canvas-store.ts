import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CanvasCardType = "text" | "note" | "web";

export interface CanvasCard {
  id: string;
  type: CanvasCardType;
  title: string;
  body: string;
  path?: string;
  url?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasConnection {
  id: string;
  sourceId: string;
  targetId: string;
  color: string;
}

export interface CanvasGroup {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

interface CanvasState {
  cards: CanvasCard[];
  connections: CanvasConnection[];
  groups: CanvasGroup[];
  selectedCardId: string | null;
  connectionSourceId: string | null;
  pan: { x: number; y: number };
  zoom: number;
  addCard: (card: Omit<CanvasCard, "id">) => void;
  updateCard: (id: string, patch: Partial<CanvasCard>) => void;
  moveCard: (id: string, x: number, y: number) => void;
  deleteSelected: () => void;
  addConnection: (sourceId: string, targetId: string) => void;
  addGroup: () => void;
  updateGroup: (id: string, patch: Partial<CanvasGroup>) => void;
  setSelectedCardId: (id: string | null) => void;
  setConnectionSourceId: (id: string | null) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setZoom: (zoom: number) => void;
  resetCanvas: () => void;
}

const seedCards: CanvasCard[] = [
  {
    id: "card-dashboard",
    type: "text",
    title: "Dashboard",
    body: "Use this canvas for projects, dashboards, mood boards, and research maps.",
    x: 180,
    y: 140,
    width: 280,
    height: 170,
  },
  {
    id: "card-note",
    type: "note",
    title: "Project Atlas",
    body: "Linked vault note. Double-click to open it in the editor.",
    path: "Projects/Project Atlas.md",
    x: 560,
    y: 230,
    width: 280,
    height: 160,
  },
];

const seedGroups: CanvasGroup[] = [
  { id: "group-planning", label: "Planning", x: 120, y: 90, width: 780, height: 380, color: "rgba(139,124,255,0.09)" },
];

const seedConnections: CanvasConnection[] = [
  { id: "conn-seed", sourceId: "card-dashboard", targetId: "card-note", color: "#8B7CFF" },
];

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      cards: seedCards,
      groups: seedGroups,
      connections: seedConnections,
      selectedCardId: "card-dashboard",
      connectionSourceId: null,
      pan: { x: 0, y: 0 },
      zoom: 1,
      addCard: (card) =>
        set((state) => {
          const id = `card-${Date.now()}`;
          return { cards: [...state.cards, { ...card, id }], selectedCardId: id };
        }),
      updateCard: (id, patch) => set((state) => ({ cards: state.cards.map((card) => (card.id === id ? { ...card, ...patch } : card)) })),
      moveCard: (id, x, y) => get().updateCard(id, { x, y }),
      deleteSelected: () =>
        set((state) => {
          if (!state.selectedCardId) return state;
          return {
            cards: state.cards.filter((card) => card.id !== state.selectedCardId),
            connections: state.connections.filter((connection) => connection.sourceId !== state.selectedCardId && connection.targetId !== state.selectedCardId),
            selectedCardId: null,
            connectionSourceId: null,
          };
        }),
      addConnection: (sourceId, targetId) =>
        set((state) => {
          if (sourceId === targetId || state.connections.some((connection) => connection.sourceId === sourceId && connection.targetId === targetId)) {
            return { connectionSourceId: null };
          }
          return {
            connections: [...state.connections, { id: `conn-${Date.now()}`, sourceId, targetId, color: "#8B7CFF" }],
            connectionSourceId: null,
          };
        }),
      addGroup: () =>
        set((state) => ({
          groups: [
            ...state.groups,
            { id: `group-${Date.now()}`, label: "Group", x: 220 + state.groups.length * 28, y: 160 + state.groups.length * 28, width: 520, height: 280, color: "rgba(109,141,255,0.08)" },
          ],
        })),
      updateGroup: (id, patch) => set((state) => ({ groups: state.groups.map((group) => (group.id === id ? { ...group, ...patch } : group)) })),
      setSelectedCardId: (selectedCardId) => set({ selectedCardId }),
      setConnectionSourceId: (connectionSourceId) => set({ connectionSourceId }),
      setPan: (pan) => set({ pan }),
      setZoom: (zoom) => set({ zoom: Math.min(2.4, Math.max(0.35, zoom)) }),
      resetCanvas: () => set({ cards: seedCards, groups: seedGroups, connections: seedConnections, selectedCardId: "card-dashboard", connectionSourceId: null, pan: { x: 0, y: 0 }, zoom: 1 }),
    }),
    {
      name: "lattice-canvas",
      version: 1,
    },
  ),
);
