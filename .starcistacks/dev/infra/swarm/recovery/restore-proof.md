# Development recovery record

Local development data is disposable. The local Supabase stack (Postgres, Auth, Storage) holds no production data: the repository
migrations under `supabase/migrations` and the seed rebuild it. `supabase db reset` is the restore, and `npm run db:reset` runs it.

No backup exists and none is needed. After a reset, run the local stack and the smoke steps of the development runbook to prove the rebuild.
