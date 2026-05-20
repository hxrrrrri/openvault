import { create } from "zustand";
import type { CommandItem, SearchResult } from "@/types/domain";
import { commands, coreCommands } from "@/lib/commands";

interface SearchState {
  query: string;
  results: SearchResult[];
  commands: CommandItem[];
  activeIndex: number;
  setQuery: (query: string) => Promise<void>;
  setActiveIndex: (index: number) => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: "",
  results: [],
  commands: coreCommands,
  activeIndex: 0,
  async setQuery(query) {
    const [results, commandResults] = await Promise.all([
      commands.search(query).catch(() => []),
      commands.commandSearch(query).catch(() => coreCommands),
    ]);
    set({ query, results, commands: mergeCommands(coreCommands, commandResults), activeIndex: 0 });
  },
  setActiveIndex: (activeIndex) => set({ activeIndex }),
}));

function mergeCommands(local: CommandItem[], remote: CommandItem[]): CommandItem[] {
  const byId = new Map<string, CommandItem>();
  for (const item of [...local, ...remote]) {
    byId.set(item.id, item);
  }
  return Array.from(byId.values());
}
