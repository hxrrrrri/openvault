# Search And Indexing

Phase 1 uses SQLite and FTS5 for filename and content search. The indexer extracts:

- headings
- wikilinks
- Markdown links and embeds
- tags
- YAML frontmatter properties
- tasks
- content hashes

Phase 2 adds vector search through the semantic search abstraction. Local embeddings are the default path; cloud providers require explicit opt-in.
