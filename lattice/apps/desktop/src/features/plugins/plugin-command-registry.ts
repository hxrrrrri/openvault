import type { CommandItem } from "@/types/domain";

export interface RegisteredPluginCommand {
  item: CommandItem;
  run: () => void | Promise<void>;
  dispose?: () => void;
}

const commands = new Map<string, RegisteredPluginCommand>();

export function registerPluginCommand(command: RegisteredPluginCommand): () => void {
  commands.get(command.item.id)?.dispose?.();
  commands.set(command.item.id, command);
  return () => {
    const current = commands.get(command.item.id);
    if (current === command) commands.delete(command.item.id);
  };
}

export function listPluginCommands(query = ""): CommandItem[] {
  const normalized = query.trim().toLowerCase();
  return Array.from(commands.values())
    .map((command) => command.item)
    .filter((item) => !normalized || item.label.toLowerCase().includes(normalized));
}

export async function runPluginCommand(id: string): Promise<boolean> {
  const command = commands.get(id);
  if (!command) return false;
  await command.run();
  return true;
}

export function clearPluginCommandsForPlugin(pluginId: string): void {
  for (const [id, command] of commands) {
    if (id.startsWith(`${pluginId}:`)) {
      command.dispose?.();
      commands.delete(id);
    }
  }
}
