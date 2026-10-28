-- The Sales action lookup of the back end (be/src/modules/domain/sales): the job outbox is not granted to app_be, so the two reads that answer "what became of the
-- action I just queued" go through this definer function. Key it by the queue dedupe key (the just-enqueued action) or by the outbox id (a status poll);
-- the caller passes exactly one. Only decisions-queue jobs and shipment ticks of the automation queue are visible, as before.
CREATE OR REPLACE FUNCTION public.sales_action_find(p_workspace uuid, p_dedupe_key text DEFAULT NULL, p_outbox uuid DEFAULT NULL)
RETURNS TABLE(id uuid, state text, work_item_id text, work_status text, target_found boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT o.id, o.state, COALESCE(o.payload->>'workItemId', e.work_item_id::text) AS work_item_id,
    w.status AS work_status,
    CASE WHEN o.payload ? 'workItemId' OR e.work_item_id IS NOT NULL THEN w.id IS NOT NULL
         WHEN o.payload ? 'executionId' THEN e.id IS NOT NULL
         ELSE s.id IS NOT NULL END AS target_found
  FROM public.job_outbox o
  LEFT JOIN public.executions e ON e.id::text = o.payload->>'executionId' AND e.workspace_id = o.workspace_id
  LEFT JOIN public.work_items w ON w.id::text = COALESCE(o.payload->>'workItemId', e.work_item_id::text) AND w.workspace_id = o.workspace_id
  LEFT JOIN public.orders s ON s.id::text = o.payload->>'orderId' AND s.workspace_id = o.workspace_id
  WHERE o.workspace_id = p_workspace
    AND ((p_dedupe_key IS NOT NULL AND o.dedupe_key = p_dedupe_key) OR (p_outbox IS NOT NULL AND o.id = p_outbox))
    AND (o.queue = 'decisions' OR (o.queue = 'automation' AND o.name = 'automation.tick' AND o.payload->>'kind' = 'shipment'))
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.sales_action_find(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sales_action_find(uuid, text, uuid) TO app_be;
