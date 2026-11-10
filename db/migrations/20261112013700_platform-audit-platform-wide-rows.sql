-- platform-audit-platform-wide-rows: forward-only; immutable once on origin/main.
-- D-P10-8 (restart FOURTEEN, 2026-11-11 18:30:48): a platform admin listing the workspaces (`adminWorkspaces`, action `view.workspaces`)
-- read them, but the audit row of that read was refused by row-level security (`platform_audit.write_failed`, 42501).
--
-- public.platform_audit is the trail of the PLATFORM console, not a tenant table: `workspace_id` names the workspace an action was
-- about and is NULL by design for an action about no single workspace (the list of all workspaces, the health page, a search). The
-- baseline gave it the row policies every tenant table has (`workspace_id IS NOT NULL`), so every platform-wide row was refused on
-- insert and hidden on read (the console's "recent" list never showed one).
--
-- The two policies of the application role now key on the row itself (`id IS NOT NULL`, as the other non-tenant tables do, e.g.
-- app_commands). Nothing else changes: the grants stay SELECT and INSERT for app_be only (no UPDATE, no DELETE: the trail is
-- append-only), anon and authenticated keep none, and no tenant table is touched.

ALTER POLICY platform_audit_app_be_insert ON public.platform_audit WITH CHECK ((id IS NOT NULL));
ALTER POLICY platform_audit_app_be_select ON public.platform_audit USING ((id IS NOT NULL));
