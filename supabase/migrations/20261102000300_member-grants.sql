-- v0.3.2 step 2: what each member may approve. One row per member and action: the largest amount the member may approve, counted in
-- the unit of the action (a missing maximum means no limit). The workspace owner always may approve; everyone else needs a row.
-- A grant dies with its member and with its action.

CREATE TABLE public.member_grants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    member_id uuid NOT NULL,
    action text NOT NULL,
    unit text DEFAULT 'vnd'::text NOT NULL,
    max_amount numeric,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT member_grants_pkey PRIMARY KEY (id),
    CONSTRAINT member_grants_member_action_key UNIQUE (member_id, action),
    CONSTRAINT member_grants_unit_check CHECK ((unit = ANY (ARRAY['vnd'::text, 'percent'::text, 'count'::text]))),
    CONSTRAINT member_grants_max_amount_check CHECK (((max_amount IS NULL) OR (max_amount >= (0)::numeric))),
    CONSTRAINT member_grants_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE,
    CONSTRAINT member_grants_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.workspace_members(id) ON DELETE CASCADE,
    CONSTRAINT member_grants_action_fkey FOREIGN KEY (action) REFERENCES public.authority_actions(action) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE INDEX member_grants_workspace_action_idx ON public.member_grants USING btree (workspace_id, action);

ALTER TABLE public.member_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY member_grants_app_be_select ON public.member_grants FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));
CREATE POLICY member_grants_app_be_insert ON public.member_grants FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));
CREATE POLICY member_grants_app_be_update ON public.member_grants FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));
CREATE POLICY member_grants_app_be_delete ON public.member_grants FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

REVOKE ALL ON TABLE public.member_grants FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.member_grants TO app_be;
