export interface CommandRegistration {
  id: string;
  title: string;
  callback: () => void | Promise<void>;
}

export interface CommandAPI {
  register(command: CommandRegistration): () => void;
}
