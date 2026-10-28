-- The main list connections seek by workspace, immutable creation time and unique id.
CREATE INDEX leads_workspace_created_id_idx
    ON public.leads (workspace_id, created_at DESC, id DESC);

CREATE INDEX orders_workspace_created_id_idx
    ON public.orders (workspace_id, created_at DESC, id DESC);

CREATE INDEX work_threads_workspace_created_id_idx
    ON public.work_threads (workspace_id, created_at DESC, id DESC);

CREATE INDEX work_threads_workspace_lead_created_id_idx
    ON public.work_threads (workspace_id, lead_id, created_at DESC, id DESC);
