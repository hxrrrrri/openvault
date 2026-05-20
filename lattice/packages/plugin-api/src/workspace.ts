export interface WorkspaceAPI {
  openNote(path: string): Promise<void>;
  revealInFileTree(path: string): Promise<void>;
  registerView(id: string, title: string): void;
}
