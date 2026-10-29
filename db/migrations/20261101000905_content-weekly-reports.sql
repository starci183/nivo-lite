-- The weekly marketing report per workspace and week: the top posts and the model's suggestion it computed (so a report read
-- does not call the channels and the model again) and when its card was posted into the Hub (so the weekly job posts it once).
-- Owner capability: be/src/modules/domain/content-weekly-reports.

CREATE TABLE public.content_weekly_reports (
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    week_start date NOT NULL,
    posts jsonb DEFAULT '[]'::jsonb NOT NULL,
    post_count integer DEFAULT 0 NOT NULL,
    suggestion jsonb,
    computed_at timestamp with time zone,
    posted_at timestamp with time zone,
    PRIMARY KEY (workspace_id, week_start),
    CONSTRAINT content_weekly_reports_post_count_check CHECK ((post_count >= 0)),
    CONSTRAINT content_weekly_reports_posts_check CHECK ((jsonb_typeof(posts) = 'array'::text))
);

ALTER TABLE public.content_weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY content_weekly_reports_app_be_all ON public.content_weekly_reports TO app_be
    USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

REVOKE ALL ON TABLE public.content_weekly_reports FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.content_weekly_reports TO app_be;

-- The AI Marketing tick (be/src/features/jobs/run-marketing-tick): every quarter hour it publishes the Zalo OA articles whose
-- moment has come and posts the weekly report cards that are due.
SELECT pgmq.create('marketing_tick');
