# Lite conversion baseline

Historical record of the start of the conversion (the engine it mentions was retired at the cutover). The database baseline that replaced the migration history is `supabase/migrations/20261013142504_lite-baseline.sql`; the dead engine objects it still carried are dropped by `20261020110000_drop-engine-schema.sql`.

Recorded at the end of Wave 0 on branch lite/convert with `starci app check` (ruling worktree D:/starci-lanes/lite-ruling, manifest 2.2.0).

Total findings: 6786 (all errors) over 1663 tracked files. The lanes drive each rule to 0.

| Rule                          | Count |
| ----------------------------- | ----- |
| FE_SUPABASE_CLIENT_OWNER      | 1744  |
| FE_DB_ERROR_HANDLED           | 1255  |
| HFS_FORMAT                    | 1206  |
| HFS_DOC_NOT_ENGLISH           | 1161  |
| DB_POLICY_SHAPE               | 286   |
| FE_DB_RESULT_TYPED            | 248   |
| HFS_SLOT_UNDECLARED           | 197   |
| DB_MIGRATION_SHAPE            | 136   |
| FE_SLOT_FILE_ROLE             | 113   |
| FE_I18N_PLACEMENT             | 111   |
| DB_DEFINER_SAFE               | 93    |
| FE_SERVICE_ROLE_FORBIDDEN     | 43    |
| DB_RLS_REQUIRED               | 38    |
| DB_DYNAMIC_DDL                | 35    |
| FE_ROUTE_HANDLER_FORBIDDEN    | 32    |
| HFS_SLOT_REQUIRED_MISSING     | 21    |
| HFS_CANON_PIN_DRIFT           | 13    |
| HFS_DEP_VERSION_SKEW          | 12    |
| HFS_ROOT_ENTRY_FORBIDDEN      | 6     |
| HFS_README_SECTION_MISSING    | 5     |
| HFS_REQUIRED_FILE_MISSING     | 5     |
| FE_ERROR_BOUNDARY_MISSING     | 4     |
| HFS_DOCKER_BASE_PIN           | 3     |
| BE_KIND_DECLARATION           | 2     |
| FE_AUTH_SESSION_TRUST         | 2     |
| HFS_PLAINTEXT_SECRET          | 2     |
| HFS_README_PRIVATE_URL        | 2     |
| HFS_SERVICE_PLACEMENT         | 2     |
| ARCH_GRAMMAR_CONTRACT_INVALID | 1     |
| DB_CONFIG_POLICY              | 1     |
| DB_STORAGE_POLICY             | 1     |
| HFS_DOCKER_BUILD_CONTEXT      | 1     |
| HFS_DOCKER_STAGES             | 1     |
| HFS_EMPTY_DIR                 | 1     |
| HFS_MONO_FE_WORKSPACE         | 1     |
| HFS_MONO_WORKSPACES           | 1     |
| HFS_SLOT_NOT_ENABLED          | 1     |

Other gates at the baseline:

- `npm run typecheck`, `npm run build:be` and `npm run build -w @nivo-lite/web` pass.
- `npm test` (be unit specs): 34 suites, 147 tests, platform roles at 100%.
- `cd be && npx eslint apps src`: 20 HFS_UNUSED_EXPORT errors (index exports of the platform with no consumer yet; they clear as features land).
- The pre-commit hook fails on legacy content (prettier on unformatted fe scripts, docs and resources); pure moves were committed with HUSKY=0.
