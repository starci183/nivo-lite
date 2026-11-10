-- brain-lesson-candidates: forward-only; immutable once on origin/main. Expand only: one new table, nothing else touched.
-- Self-learning from the founder's answers (owner, 2026-11-11: "agent tự học trong quá trình làm việc với khách … in ra message truth
-- graph và lí do sao"). Every stop of kind ai_report that a person answered in free text is kept here as a lesson CANDIDATE: the question
-- the agent could not handle (masked: no phone, no e-mail), the step and workflow it stopped at, the person's words, what the step then
-- did. Candidates of the same gap (same agent + workflow + step + near question words) share group_id. When a group repeats (or one answer
-- states a rule) the engine drafts a truth and posts it as a brain.change card (origin "learning"); the founder's yes closes the group as
-- learned (fact_id = the truth now in force); a no marks it declined (not proposed again until a NEW, different answer comes).
-- No customer id, no conversation id: a lesson is about the shop's rule; per-customer facts stay in lead memory.

CREATE TABLE public.brain_lesson_candidates (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    stop_id uuid NOT NULL,
    run_id uuid NOT NULL,
    step_key text NOT NULL,
    agent_id uuid NOT NULL,
    workflow_id uuid,
    question text NOT NULL,
    keywords text[] DEFAULT '{}'::text[] NOT NULL,
    answer text NOT NULL,
    answered_by text NOT NULL,
    answered_at timestamptz NOT NULL,
    then_did text NOT NULL,
    general boolean,
    group_id uuid NOT NULL,
    status text DEFAULT 'candidate'::text NOT NULL,
    change_id text,
    fact_slug text,
    fact_key jsonb,
    fact_id uuid,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT brain_lesson_candidates_status_check CHECK ((status = ANY (ARRAY['candidate'::text, 'proposing'::text, 'proposed'::text, 'learned'::text, 'declined'::text]))),
    CONSTRAINT brain_lesson_candidates_then_check CHECK ((then_did = ANY (ARRAY['completed'::text, 'stopped_again'::text, 'skipped'::text, 'open'::text]))),
    CONSTRAINT brain_lesson_candidates_question_check CHECK ((char_length(question) <= 600)),
    CONSTRAINT brain_lesson_candidates_answer_check CHECK ((char_length(answer) <= 1000)),
    CONSTRAINT brain_lesson_candidates_answer_unique UNIQUE (workspace_id, stop_id, answered_at)
);

-- The group finder: the recent candidates of one step of one agent's workflow.
CREATE INDEX brain_lesson_candidates_place ON public.brain_lesson_candidates USING btree (workspace_id, agent_id, step_key, answered_at DESC);
-- The founder's decision on a card names its change.
CREATE INDEX brain_lesson_candidates_change ON public.brain_lesson_candidates USING btree (workspace_id, change_id) WHERE (change_id IS NOT NULL);
-- One open card per fact key.
CREATE INDEX brain_lesson_candidates_fact_open ON public.brain_lesson_candidates USING btree (workspace_id, fact_slug) WHERE (status = 'proposed'::text);

CREATE TRIGGER brain_lesson_candidates_set_updated_at BEFORE UPDATE ON public.brain_lesson_candidates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.brain_lesson_candidates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.brain_lesson_candidates FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.brain_lesson_candidates TO app_be;
CREATE POLICY brain_lesson_candidates_app_be_select ON public.brain_lesson_candidates FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));
CREATE POLICY brain_lesson_candidates_app_be_insert ON public.brain_lesson_candidates FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));
CREATE POLICY brain_lesson_candidates_app_be_update ON public.brain_lesson_candidates FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));
CREATE POLICY brain_lesson_candidates_app_be_delete ON public.brain_lesson_candidates FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));
