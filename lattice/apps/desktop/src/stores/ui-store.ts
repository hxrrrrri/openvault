import { create } from "zustand";
import type { WorkspaceView } from "@/types/domain";

interface UIState {
  view: WorkspaceView;
  paletteOpen: boolean;
  leftOpen: boolean;
  rightOpen: boolean;
  mobilePreview: boolean;
  setView: (view: WorkspaceView) => void;
  setPaletteOpen: (open: boolean) => void;
  togglePalette: () => void;
  setLeftOpen: (open: boolean) => void;
  setRightOpen: (open: boolean) => void;
  setMobilePreview: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  view: "workspace",
  paletteOpen: false,
  leftOpen: true,
  rightOpen: true,
  mobilePreview: false,
  setView: (view) => set({ view }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  togglePalette: () => set((state) => ({ paletteOpen: !state.paletteOpen })),
  setLeftOpen: (leftOpen) => set({ leftOpen }),
  setRightOpen: (rightOpen) => set({ rightOpen }),
  setMobilePreview: (mobilePreview) => set({ mobilePreview }),
}));
