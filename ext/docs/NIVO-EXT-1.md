---
rule: NIVO-EXT-1
concept:
  - .starciwork/concepts/project-ext.md
---

# NIVO-EXT-1: every project rule and check cites a concept topic file that exists

Code `NIVO_EXT_CONCEPT_UNKNOWN`, severity error. Engine: hfs rule `ext/hfs/concept-keys.mjs` (`(context) => findings`), run by
`starci app check` from hfs 6.9.0 on, and by `npm run ext:check` before that.

## What it enforces

- `.starciwork/concepts/README.md` (the concept catalog) exists.
- Each rule of `ext/manifest.json` has its `doc` file below `ext/`, whose front matter names `rule: <its id>` and a non-empty `concept` list.
- Each check of `ext/manifest.json` has the doc `ext/docs/checks/<id>.md`, whose front matter names `check: <its id>` and a non-empty
  `concept` list (the manifest gives a check no `doc` key, so this folder is the convention).
- Every citation is the path of a concept topic file, `.starciwork/concepts/<topic>.md` (`tools.md`, `templates.md`, ...), and that file
  exists. A cited file that does not exist, a doc that cites none, and `README.md` as a citation are findings.
- Each ESLint rule (`lint.file`) names, in `meta.docs.concept`, the same paths as its doc.

## Why

A project law is a recorded decision of the project (PROJECT-LINT-3). A rule that cites a concept nobody wrote, or a doc that drifts from its
rule, is a law without a source.

## Concept

`.starciwork/concepts/project-ext.md`: NIVO's own project rules, lint and checks live in `ext/`; a law lives there with a spec and a doc.

## Examples

Valid front matter:

```yaml
---
rule: NIVO-NAMES-1
concept:
  - .starciwork/concepts/tools.md
---
```

Invalid: `.starciwork/concepts/noSuchTopic.md` (no such file), a front matter with no `concept` list, a doc whose `rule` is another id,
a lint rule whose `meta.docs.concept` names other files than its doc.
