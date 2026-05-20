export interface VaultAPI {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  list(pattern?: string): Promise<string[]>;
  onDidChange(callback: (path: string) => void): () => void;
}
