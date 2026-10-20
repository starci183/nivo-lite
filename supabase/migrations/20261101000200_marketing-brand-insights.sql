-- AI Marketing (content module): the brand kit read from a guideline PDF, its confirm card, and the daily engagement the weekly
-- report reads. Forward only; nothing existing changes meaning.

ALTER TABLE public.content_settings
    ADD COLUMN IF NOT EXISTS brand_colors jsonb DEFAULT '[]'::jsonb NOT NULL,
    ADD COLUMN IF NOT EXISTS brand_fonts text[] DEFAULT '{}'::text[] NOT NULL,
    ADD COLUMN IF NOT EXISTS brand_tone text DEFAULT ''::text NOT NULL,
    ADD COLUMN IF NOT EXISTS brand_imagery text[] DEFAULT '{}'::text[] NOT NULL,
    ADD COLUMN IF NOT EXISTS brand_source text DEFAULT ''::text NOT NULL;

-- One brand kit the model read from a file the owner attached in the setup chat; written to the settings only once confirmed.
CREATE TABLE public.content_brand_proposals (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    installation_id uuid,
    setup_session_id uuid,
    file_name text NOT NULL,
    file_size integer DEFAULT 0 NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'proposed'::text NOT NULL,
    decided_by text,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_brand_proposals_status_check CHECK ((status = ANY (ARRAY['proposed'::text, 'applied'::text, 'rejected'::text]))),
    CONSTRAINT content_brand_proposals_file_name_check CHECK ((char_length(file_name) BETWEEN 1 AND 255))
);
CREATE INDEX content_brand_proposals_workspace_idx ON public.content_brand_proposals (workspace_id, created_at DESC);

-- The daily reach and engagement of each social channel of a workspace, upserted by the insights sync.
CREATE TABLE public.content_engagement_daily (
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    channel text NOT NULL,
    day date NOT NULL,
    reach integer DEFAULT 0 NOT NULL,
    engagements integer DEFAULT 0 NOT NULL,
    messages integer DEFAULT 0 NOT NULL,
    synced_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (workspace_id, channel, day),
    CONSTRAINT content_engagement_daily_channel_check CHECK ((channel = ANY (ARRAY['facebook'::text, 'zalo'::text, 'instagram'::text, 'tiktok'::text]))),
    CONSTRAINT content_engagement_daily_counts_check CHECK (((reach >= 0) AND (engagements >= 0) AND (messages >= 0)))
);

ALTER TABLE public.content_brand_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_engagement_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY content_brand_proposals_app_be_all ON public.content_brand_proposals TO app_be
    USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));
CREATE POLICY content_engagement_daily_app_be_all ON public.content_engagement_daily TO app_be
    USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

REVOKE ALL ON TABLE public.content_brand_proposals FROM anon, authenticated;
REVOKE ALL ON TABLE public.content_engagement_daily FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.content_brand_proposals TO app_be;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.content_engagement_daily TO app_be;
