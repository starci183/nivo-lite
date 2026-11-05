import type { SqlText } from "@modules/platform/database"
import { sql } from "@modules/platform/database"

/** The tables only the engine role reaches: the records, their links and the counters. */
export const ENGINE_TABLES = ["records", "record_links", "entity_sequences"] as const

/** One of the engine tables. */
export type EngineTable = (typeof ENGINE_TABLES)[number]

/** Becomes the back-end role for the rest of the current transaction, as a pooled app_be connection is (the world connects as a superuser). */
export const AS_BACKEND_LOCAL: SqlText = sql`SET LOCAL SESSION AUTHORIZATION app_be`

/** Becomes the back-end role for the rest of the connection; the proof resets it before the connection goes back to the pool. */
export const AS_BACKEND_SESSION: SqlText = sql`SET SESSION AUTHORIZATION app_be`

/** Gives the connection back its own identity. */
export const RESET_AUTHORIZATION: SqlText = sql`RESET SESSION AUTHORIZATION`

/** Who the statements run as and which workspace the transaction was scoped to. */
export const IDENTITY: SqlText = sql`SELECT current_user::text AS role, session_user::text AS session, pg_catalog.current_setting('nivo.workspace_id', true) AS workspace`

/** The back-end role tries to become a role it was never granted. */
export const BECOME_POSTGRES: SqlText = sql`SELECT pg_catalog.set_config('role', 'postgres', true)`

/** Restores the back-end role inside a transaction (the engine never does). */
export const BECOME_BACKEND: SqlText = sql`SELECT pg_catalog.set_config('role', 'app_be', true)`

/** Marks the point a refused statement rolls back to, so the transaction can go on. */
export const SAVEPOINT_PROBE: SqlText = sql`SAVEPOINT probe`

/** Returns to the mark after a refused statement. */
export const ROLLBACK_TO_PROBE: SqlText = sql`ROLLBACK TO SAVEPOINT probe`

/** Forgets the mark after a statement that was accepted. */
export const RELEASE_PROBE: SqlText = sql`RELEASE SAVEPOINT probe`

/** The workspace of every row of an engine table, with no WHERE: the deliberately broken statement RLS must still contain. */
export const WORKSPACES_OF: Readonly<Record<EngineTable, SqlText>> = {
    records: sql`SELECT workspace_id::text AS workspace_id FROM public.records ORDER BY 1`,
    record_links: sql`SELECT workspace_id::text AS workspace_id FROM public.record_links ORDER BY 1`,
    entity_sequences: sql`SELECT workspace_id::text AS workspace_id FROM public.entity_sequences ORDER BY 1`,
}

/** The facts of the engine role itself. */
export const ENGINE_ROLE: SqlText = sql`SELECT rolcanlogin AS login, rolinherit AS inherit, rolbypassrls AS bypass, rolsuper AS super FROM pg_roles WHERE rolname = 'app_engine'`

/** Every role that is a member of the engine role, with the options of the grant. */
export const ENGINE_MEMBERS: SqlText = sql`SELECT g.rolname::text AS member, m.set_option AS set_option, m.inherit_option AS inherit_option FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.roleid JOIN pg_roles g ON g.oid = m.member WHERE r.rolname = 'app_engine' ORDER BY 1`

/** Whether a role may execute a function of the scope. */
export const CAN_EXECUTE: SqlText = sql`SELECT has_function_privilege($1, $2, 'EXECUTE') AS allowed`

/** Whether PUBLIC may execute a function: read from its ACL. */
export const PUBLIC_EXECUTE: SqlText = sql`SELECT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE p.oid = $1::regprocedure AND a.grantee = 0 AND a.privilege_type = 'EXECUTE') AS allowed`

/** The privileges a role holds on a table, one flag per command. */
export const TABLE_PRIVILEGES: SqlText = sql`SELECT has_table_privilege($1, $2::regclass, 'SELECT') AS can_select, has_table_privilege($1, $2::regclass, 'INSERT') AS can_insert, has_table_privilege($1, $2::regclass, 'UPDATE') AS can_update, has_table_privilege($1, $2::regclass, 'DELETE') AS can_delete, has_table_privilege($1, $2::regclass, 'TRUNCATE') AS can_truncate, has_table_privilege($1, $2::regclass, 'REFERENCES') AS can_reference, has_table_privilege($1, $2::regclass, 'TRIGGER') AS can_trigger`

/** Whether a role may use a schema. */
export const SCHEMA_USAGE: SqlText = sql`SELECT has_schema_privilege($1, $2, 'USAGE') AS allowed`

/** The engine policies, by table, name, command and role. */
export const ENGINE_POLICIES: SqlText = sql`SELECT tablename::text AS tablename, policyname::text AS policyname, cmd::text AS cmd, roles::text[] AS roles, qual AS using_text, with_check AS check_text FROM pg_policies WHERE schemaname = 'public' AND policyname LIKE '%\\_app\\_engine\\_%' ORDER BY policyname`

/** Whether row-level security is on for the tables. */
export const RLS_FLAGS: SqlText = sql`SELECT c.relname::text AS name, c.relrowsecurity AS enabled FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relname = ANY($1::text[]) ORDER BY c.relname`

/** The schema an extension lives in. */
export const EXTENSION_SCHEMA: SqlText = sql`SELECT n.nspname::text AS schema FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = $1`

/** Whether the records table is partitioned by list and has no default partition. */
export const RECORDS_PARTITIONING: SqlText = sql`SELECT (SELECT partstrat::text FROM pg_partitioned_table WHERE partrelid = 'public.records'::regclass) AS strategy, (SELECT count(*)::int FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid WHERE i.inhparent = 'public.records'::regclass AND pg_get_expr(c.relpartbound, c.oid) = 'DEFAULT') AS defaults`

/** The foreign keys of the links, by name and definition. */
export const LINK_FOREIGN_KEYS: SqlText = sql`SELECT conname::text AS name, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'public.record_links'::regclass AND contype = 'f' ORDER BY conname`
