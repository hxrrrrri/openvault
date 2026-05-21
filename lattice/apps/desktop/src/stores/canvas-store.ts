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
  selectedGroupId: string | null;
  connectionSourceId: string | null;
  pan: { x: number; y: number };
  zoom: number;
  addCard: (card: Omit<CanvasCard, "id">) => void;
  updateCard: (id: string, patch: Partial<CanvasCard>) => void;
  moveCard: (id: string, x: number, y: number) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  clearCanvas: () => void;
  replaceCanvas: (snapshot: Pick<CanvasState, "cards" | "connections" | "groups">) => void;
  addConnection: (sourceId: string, targetId: string) => void;
  addGroup: (group?: Partial<Omit<CanvasGroup, "id">>) => void;
  updateGroup: (id: string, patch: Partial<CanvasGroup>) => void;
  setSelectedCardId: (id: string | null) => void;
  setSelectedGroupId: (id: string | null) => void;
  setConnectionSourceId: (id: string | null) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setZoom: (zoom: number) => void;
  resetCanvas: () => void;
}

const DEMO_CARD_IDS = new Set(["card-dashboard", "card-note"]);
const DEMO_GROUP_IDS = new Set(["group-planning"]);
const DEMO_CONNECTION_IDS = new Set(["conn-seed"]);

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      cards: [],
      groups: [],
      connections: [],
      selectedCardId: null,
      selectedGroupId: null,
      connectionSourceId: null,
      pan: { x: 0, y: 0 },
      zoom: 1,
      addCard: (card) =>
        set((state) => {
          const id = `card-${Date.now()}`;
          return { cards: [...state.cards, { ...card, id }], selectedCardId: id, selectedGroupId: null };
        }),
      updateCard: (id, patch) => set((state) => ({ cards: state.cards.map((card) => (card.id === id ? { ...card, ...patch } : card)) })),
      moveCard: (id, x, y) => get().updateCard(id, { x, y }),
      deleteSelected: () =>
        set((state) => {
          if (state.selectedGroupId) {
            return {
              groups: state.groups.filter((group) => group.id !== state.selectedGroupId),
              selectedGroupId: null,
              connectionSourceId: null,
            };
          }
          if (!state.selectedCardId) return state;
          return {
            cards: state.cards.filter((card) => card.id !== state.selectedCardId),
            connections: state.connections.filter((connection) => connection.sourceId !== state.selectedCardId && connection.targetId !== state.selectedCardId),
            selectedCardId: null,
            connectionSourceId: null,
          };
        }),
      duplicateSelected: () =>
        set((state) => {
          if (state.selectedCardId) {
            const source = state.cards.find((card) => card.id === state.selectedCardId);
            if (!source) return state;
            const id = `card-${Date.now()}`;
            return {
              cards: [...state.cards, { ...source, id, title: `${source.title} copy`, x: source.x + 32, y: source.y + 32 }],
              selectedCardId: id,
              selectedGroupId: null,
            };
          }
          if (state.selectedGroupId) {
            const source = state.groups.find((group) => group.id === state.selectedGroupId);
            if (!source) return state;
            const id = `group-${Date.now()}`;
            return {
              groups: [...state.groups, { ...source, id, label: `${source.label} copy`, x: source.x + 32, y: source.y + 32 }],
              selectedCardId: null,
              selectedGroupId: id,
            };
          }
          return state;
        }),
      clearCanvas: () => set({ cards: [], groups: [], connections: [], selectedCardId: null, selectedGroupId: null, connectionSourceId: null, pan: { x: 0, y: 0 }, zoom: 1 }),
      replaceCanvas: (snapshot) =>
        set({
          cards: snapshot.cards,
          groups: snapshot.groups,
          connections: snapshot.connections.filter((connection) =>
            snapshot.cards.some((card) => card.id === connection.sourceId) &&
            snapshot.cards.some((card) => card.id === connection.targetId),
          ),
          selectedCardId: null,
          selectedGroupId: null,
          connectionSourceId: null,
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
      addGroup: (group) =>
        set((state) => {
          const id = `group-${Date.now()}`;
          return {
            groups: [
              ...state.groups,
              {
                id,
                label: "Group",
                x: 1840 + state.groups.length * 36,
                y: 1280 + state.groups.length * 36,
                width: 560,
                height: 320,
                color: "rgba(109,141,255,0.08)",
                ...group,
              },
            ],
            selectedCardId: null,
            selectedGroupId: id,
          };
        }),
      updateGroup: (id, patch) => set((state) => ({ groups: state.groups.map((group) => (group.id === id ? { ...group, ...patch } : group)) })),
      setSelectedCardId: (selectedCardId) => set({ selectedCardId, selectedGroupId: null }),
      setSelectedGroupId: (selectedGroupId) => set({ selectedGroupId, selectedCardId: null }),
      setConnectionSourceId: (connectionSourceId) => set({ connectionSourceId }),
      setPan: (pan) => set({ pan }),
      setZoom: (zoom) => set({ zoom: Math.min(2.4, Math.max(0.35, zoom)) }),
      resetCanvas: () => set({ cards: [], groups: [], connections: [], selectedCardId: null, selectedGroupId: null, connectionSourceId: null, pan: { x: 0, y: 0 }, zoom: 1 }),
    }),
    {
      name: "lattice-canvas",
      version: 2,
      migrate: (persisted, version) => {
        if (version >= 2 || !persisted || typeof persisted !== "object") return persisted as CanvasState;
        const state = persisted as Partial<CanvasState>;
        return {
          ...state,
          cards: (state.cards ?? []).filter((card) => !DEMO_CARD_IDS.has(card.id)),
          groups: (state.groups ?? []).filter((group) => !DEMO_GROUP_IDS.has(group.id)),
          connections: (state.connections ?? []).filter((connection) => !DEMO_CONNECTION_IDS.has(connection.id)),
          selectedCardId: null,
          selectedGroupId: null,
          connectionSourceId: null,
        } as CanvasState;
      },
    },
  ),
);
