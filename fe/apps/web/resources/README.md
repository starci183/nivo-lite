# resources

This directory holds NIVO resources that are seeded into Supabase. They are versioned data in the repository, not data belonging to each business.

## Structure

```
resources/
  nivo-knowledge/           Base NIVO knowledge, read-only for workspace members
    core/                   Shared by every module
    <key>/                  One directory per module (knowledgeFolder in the be module catalogue)
      <slug>.md             One document = one row in the nivo_knowledge table
```

Each `.md` file has frontmatter:

- `title`: display title
- `kind`: `playbook` | `authority` | `escalation` | `setup_checklist` | `tone`
- `version`: integer, incremented when the content changes

The file name (without `.md`) is the unique `slug`; the parent directory is `module`. The rest is markdown content.

Other resource kinds can be added the same way later, for example `resources/knowledge-suggestions/` or `resources/templates/`, each kind its own directory and its own seed step in `scripts/`.

## Registry module

The module catalogue is typed data in `be/src/modules/domain/modules` (served by `GET /modules`); `cli seed-modules run` mirrors it into the `modules` and `authority_actions` tables. The front end reads the mirror in `src/modules/catalog`.

## Seed into Supabase

Local Supabase must be running, and migration `20261002140000_knowledge.sql` must already be applied.

```
npm run seed:knowledge
```

This command reads every file in `resources/nivo-knowledge`, updates rows by `slug` (running it again does not create copies) and creates embeddings when an API key is set (`EMBEDDING_API_KEY`, or `OPENROUTER_API_KEY`/`OPENAI_API_KEY`). Without a key the content is still seeded, and keyword search still works.
