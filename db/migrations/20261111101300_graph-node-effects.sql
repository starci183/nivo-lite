-- graph-node-effects: the ledger of the effects graph nodes run, so a node's effect acts once. Expand only: one new table.
-- ledger_key is `call:<run step key>:<order>` (a retried step) or `dedupe:<business key>` (the node said once per workspace, across runs);
-- a repeat of a key in the workspace answers the subject the first run touched and acts no more. Rows are only ever inserted and read.

CREATE TABLE public.graph_node_effects (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    ledger_key text NOT NULL,
    effect text NOT NULL,
    subject_kind text NOT NULL,
    subject_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT graph_node_effects_ledger_key_key UNIQUE (workspace_id, ledger_key),
    CONSTRAINT graph_node_effects_ledger_key_check CHECK (ledger_key ~ '^(call|dedupe):.+$' AND length(ledger_key) <= 400)
);

CREATE TRIGGER graph_node_effects_set_updated_at BEFORE UPDATE ON public.graph_node_effects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.graph_node_effects ENABLE ROW LEVEL SECURITY;
CREATE POLICY graph_node_effects_app_be_select ON public.graph_node_effects FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY graph_node_effects_app_be_insert ON public.graph_node_effects FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.graph_node_effects FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.graph_node_effects TO app_be;
