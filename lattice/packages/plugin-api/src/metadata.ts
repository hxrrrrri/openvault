import type { NoteMetadata } from "@lattice/shared";

export interface MetadataAPI {
  get(path: string): Promise<NoteMetadata>;
  backlinks(path: string): Promise<Array<{ sourcePath: string; line: number; excerpt: string }>>;
}
