# Development recovery record

Local development data is disposable. The local db container holds no production data: `db/bootstrap.sql` and the repository
migrations under `db/migrations` rebuild it. `npm run db:reset` is the restore, and `npm run db:push` applies the migrations again.

No backup exists and none is needed. After a reset, run the local stack and the smoke steps of the development runbook to prove the rebuild.
