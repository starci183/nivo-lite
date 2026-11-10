-- inbox-leads: forward-only; immutable once on origin/main.
-- The inbox becomes lead-centric. An input keeps the customer key it grouped under (a phone, a channel user id, a web visitor) and where it came
-- from (page, campaign, device); the website form that posts leads has its own site row, which the owner switches on and assigns to an agent.
-- Everything here is additive: two nullable-or-defaulted columns, three indexes, one new table.

ALTER TABLE public.inbound_events ADD COLUMN IF NOT EXISTS customer_key text;
ALTER TABLE public.inbound_events ADD COLUMN IF NOT EXISTS source jsonb NOT NULL DEFAULT '{}'::jsonb;
DO $source_check$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'inbound_events_source_check' AND conrelid = 'public.inbound_events'::regclass
    ) THEN
        ALTER TABLE public.inbound_events ADD CONSTRAINT inbound_events_source_check CHECK (jsonb_typeof(source) = 'object');
    END IF;
END;
$source_check$;

CREATE INDEX IF NOT EXISTS inbound_ws_lead ON public.inbound_events USING btree (workspace_id, lead_id, created_at DESC) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inbound_ws_customer ON public.inbound_events USING btree (workspace_id, customer_key, created_at DESC) WHERE customer_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS work_items_ws_lead ON public.work_items USING btree (workspace_id, lead_id, created_at DESC) WHERE lead_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.website_sites (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    site_key text NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    chat_enabled boolean DEFAULT true NOT NULL,
    form_enabled boolean DEFAULT true NOT NULL,
    prices_enabled boolean DEFAULT false NOT NULL,
    agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT website_sites_site_key_check CHECK (site_key ~ '^[a-z0-9]{12,40}$'),
    CONSTRAINT website_sites_workspace_key UNIQUE (workspace_id),
    CONSTRAINT website_sites_site_key_key UNIQUE (site_key)
);
CREATE TRIGGER website_sites_set_updated_at BEFORE UPDATE ON public.website_sites FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.website_sites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.website_sites FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.website_sites TO app_be;
CREATE POLICY website_sites_app_be_select ON public.website_sites FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY website_sites_app_be_insert ON public.website_sites FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY website_sites_app_be_update ON public.website_sites FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
