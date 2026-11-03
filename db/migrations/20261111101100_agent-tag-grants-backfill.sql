-- agent-tag-grants-backfill: installing an agent now grants the tag rights its module lists (chatbot tags sales and accounting, sales tags
-- accounting). A workspace that installed those agents before holds none, so a hand-off by tag stalls on "not granted". This writes the same
-- rights for the installations that exist.
-- Expand only and inert: it appends agent ids to agents.can_tag_agent_ids and touches nothing else. A right already held is kept, an agent
-- never gets itself, and rerunning it adds nothing.

WITH wanted(from_module, to_module) AS (
    VALUES ('chatbot', 'sales'), ('chatbot', 'accounting'), ('sales', 'accounting')
),
pairs AS (
    SELECT a.id AS from_agent, b.id AS to_agent
    FROM wanted w
    JOIN public.module_installations fi ON fi.module_key = w.from_module AND fi.agent_id IS NOT NULL
    JOIN public.module_installations ti ON ti.module_key = w.to_module AND ti.agent_id IS NOT NULL AND ti.workspace_id = fi.workspace_id
    JOIN public.agents a ON a.id = fi.agent_id AND a.workspace_id = fi.workspace_id
    JOIN public.agents b ON b.id = ti.agent_id AND b.workspace_id = ti.workspace_id
    WHERE a.id <> b.id
),
merged AS (
    SELECT p.from_agent, array_agg(DISTINCT p.to_agent) AS added
    FROM pairs p
    GROUP BY p.from_agent
)
UPDATE public.agents ag
SET can_tag_agent_ids = ARRAY(SELECT DISTINCT unnest(ag.can_tag_agent_ids || m.added))
FROM merged m
WHERE ag.id = m.from_agent
  AND NOT (m.added <@ ag.can_tag_agent_ids);
