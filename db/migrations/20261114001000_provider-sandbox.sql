-- provider-sandbox: forward-only; immutable once on origin/main. WRITTEN, NOT APPLIED by SBX (source only): the restart owner applies it with the code that reads it.
-- Owner rulings R56 + R58 (lane concept provider-sandbox): a provider ACCOUNT (connection) may be a SANDBOX account, answered by its
-- provider's second implementation of the same port from its hardcoded catalogue of cases (R60), never a real host. Expand only:
--   1. public.connections.sandbox boolean NOT NULL DEFAULT false: set at creation, never changed (trigger below; the service has no writer).
--   2. public.provider_sandbox_entries: the per-account STATE a call changes (a domain renewed) and the call log of a sandbox account (the
--      cases themselves are hardcoded catalogues in code, R60). Read only through a join on a live
--      (deleted_at IS NULL) sandbox connection, so a removed account's entries are hidden with it (R36); nothing cascades from connections.
-- Every existing row becomes a live account (sandbox false, no key): no behaviour of a live account changes.
ALTER TABLE public.connections ADD COLUMN sandbox boolean DEFAULT false NOT NULL;

CREATE FUNCTION public.connections_sandbox_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.sandbox IS DISTINCT FROM OLD.sandbox THEN
        RAISE EXCEPTION 'connections.sandbox is set at creation and never changed' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER connections_sandbox_immutable BEFORE UPDATE ON public.connections
    FOR EACH ROW EXECUTE FUNCTION public.connections_sandbox_immutable();

CREATE TABLE public.provider_sandbox_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id),
    connection_id uuid NOT NULL REFERENCES public.connections(id),
    kind text NOT NULL,
    operation text NOT NULL,
    key text DEFAULT ''::text NOT NULL,
    body jsonb NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT provider_sandbox_entries_kind_check CHECK ((kind = ANY (ARRAY['state'::text, 'call'::text]))),
    CONSTRAINT provider_sandbox_entries_operation_check CHECK ((char_length(operation) BETWEEN 1 AND 200)),
    CONSTRAINT provider_sandbox_entries_key_check CHECK ((char_length(key) <= 200))
);
-- The state of one operation and key (newest first) and the call log of an account, oldest first.
CREATE INDEX provider_sandbox_entries_lookup ON public.provider_sandbox_entries
    USING btree (connection_id, kind, operation, key, created_at DESC, id DESC);
CREATE INDEX provider_sandbox_entries_workspace ON public.provider_sandbox_entries USING btree (workspace_id);

CREATE TRIGGER provider_sandbox_entries_set_updated_at BEFORE UPDATE ON public.provider_sandbox_entries
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.provider_sandbox_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.provider_sandbox_entries FROM anon, authenticated;
-- DELETE: a test's reset forgets one sandbox account's state and call log.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.provider_sandbox_entries TO app_be;
CREATE POLICY provider_sandbox_entries_app_be_all ON public.provider_sandbox_entries TO app_be
    USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));
