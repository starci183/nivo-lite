-- AI Editor (the video module's agent) takes scripts other agents delegate (AI Marketing's render_script command). One row per delegation:
-- who sent it, the target channels, the project it rendered and the Hub card it posted when the render finished. The back end alone reads and writes it.

CREATE TABLE public.video_delegations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    work_item_id uuid NOT NULL,
    project_id uuid NOT NULL,
    source_module text NOT NULL,
    content_item_id uuid,
    channels text[] DEFAULT '{}'::text[] NOT NULL,
    status text DEFAULT 'rendering'::text NOT NULL,
    render_id uuid,
    approval_work_item_id uuid,
    card jsonb,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT video_delegations_pkey PRIMARY KEY (id),
    CONSTRAINT video_delegations_status_check CHECK ((status = ANY (ARRAY['rendering'::text, 'ready'::text, 'approved'::text, 'failed'::text]))),
    CONSTRAINT video_delegations_source_check CHECK ((char_length(source_module) BETWEEN 1 AND 40)),
    CONSTRAINT video_delegations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE,
    CONSTRAINT video_delegations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.video_projects(id) ON DELETE CASCADE,
    CONSTRAINT video_delegations_work_item_id_fkey FOREIGN KEY (work_item_id) REFERENCES public.work_items(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX video_delegations_work_item ON public.video_delegations USING btree (work_item_id);
CREATE INDEX video_delegations_project ON public.video_delegations USING btree (project_id);
CREATE INDEX video_delegations_content_item ON public.video_delegations USING btree (workspace_id, content_item_id) WHERE (content_item_id IS NOT NULL);

ALTER TABLE public.video_delegations ENABLE ROW LEVEL SECURITY;

CREATE POLICY video_delegations_app_be_select ON public.video_delegations FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));
CREATE POLICY video_delegations_app_be_insert ON public.video_delegations FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));
CREATE POLICY video_delegations_app_be_update ON public.video_delegations FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

REVOKE ALL ON TABLE public.video_delegations FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.video_delegations TO app_be;
