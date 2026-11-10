-- agent-door-presses: forward-only; immutable once on origin/main. Expand only: one new table, nothing else touched.
-- The owner's doors onto the agents' work (package D1, 2026-11-11): "Chạy ngay" on a scheduled item (a care timer, an agent task, a
-- schedule slot, a stop deadline), the shop's care opt-out of a customer, and "Trả lại cho agent" on a held conversation. Each press is
-- one row: who pressed (the workspace member), when, on what (the door and its subject: the item key, the lead id, the conversation id)
-- and what it came to. The doors act through the engine's own paths; this table only remembers the person and the moment, which the
-- engine's records do not keep for these doors (a deadline's timeout names no person, a care timer's tag comes from the system, the
-- lead memory keeps facts only). No customer words are stored here.

CREATE TABLE public.agent_door_presses (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    door text NOT NULL,
    subject text NOT NULL,
    member_id text NOT NULL,
    outcome text NOT NULL,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    pressed_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT agent_door_presses_door_check CHECK ((door = ANY (ARRAY['schedule.run_now'::text, 'care.opt_out'::text, 'conversation.release'::text]))),
    CONSTRAINT agent_door_presses_subject_check CHECK ((char_length(subject) BETWEEN 1 AND 300)),
    CONSTRAINT agent_door_presses_member_check CHECK ((char_length(member_id) BETWEEN 1 AND 64)),
    CONSTRAINT agent_door_presses_outcome_check CHECK ((char_length(outcome) BETWEEN 1 AND 40)),
    CONSTRAINT agent_door_presses_detail_check CHECK ((jsonb_typeof(detail) = 'object'::text))
);

-- The last press on one subject of one door (the opt-out of a lead, the run-now of an item).
CREATE INDEX agent_door_presses_subject ON public.agent_door_presses USING btree (workspace_id, door, subject, pressed_at DESC);
-- The newest presses of a door of the workspace (the schedule list shows the last press of each item).
CREATE INDEX agent_door_presses_recent ON public.agent_door_presses USING btree (workspace_id, door, pressed_at DESC);

ALTER TABLE public.agent_door_presses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agent_door_presses FROM anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.agent_door_presses TO app_be;
CREATE POLICY agent_door_presses_app_be_select ON public.agent_door_presses FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));
CREATE POLICY agent_door_presses_app_be_insert ON public.agent_door_presses FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));
