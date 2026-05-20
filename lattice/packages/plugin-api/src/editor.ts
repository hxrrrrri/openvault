export interface EditorAPI {
  getSelection(): string;
  replaceSelection(text: string): void;
  insertText(text: string): void;
}
