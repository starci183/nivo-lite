-- customer-routes: forward-only; immutable once on origin/main. WRITTEN, NOT APPLIED by anyone in the DECOUPLE lane: RESTART-R applies it
-- (no database has run this DDL yet). Expand only: two NEW core tables of the engine, no existing table or row touched.
-- Decoupling the chat flow (CHAT-DESIGN-2 M1 / M2, rulings R8 R9 R10): the engine keeps its own routes and its own delivery ledger and
-- knows no conversation of any plugin. Written by stores with no raw SQL on the primary connection (role app_be, the workspace bound in
-- code), like conversation_holds and contact_freezes.
-- EDITED IN PLACE 2026-11-14 by S7 (owner ruling R31, "xoá mềm nhé": deleting a contact, and a person's erasure request, are SOFT deletes;
-- this file was never applied on any database). The contact is marked deleted (public.contacts.state = 'erased' with erased_at); its routes
-- and customer lines STAY here and every read leaves them out by joining a live contact. So nothing cascades from contacts or from a route
-- any more: the foreign keys to contacts and to customer_routes are NO ACTION (a hard delete of a contact or a route that still has lines is
-- refused by the database; a workspace delete still removes everything of the workspace in one statement, because its own cascade reaches
-- the lines in the same statement), and the application role has no DELETE on either table.

-- public.customer_routes: the way the engine reaches ONE person on ONE entrance. ONE row per (workspace, contact, channel, account),
-- written by an atomic insert-or-nothing; its id is the opaque route id that every engine `conversation_id` column (conversation_holds,
-- run_stops, contact_freezes, agent_speaker_queue, contact memory, the wake scope) keeps holding: those columns change nothing. The row
-- may be born under the id of an EXISTING conversation (R10), so holds and stops keyed by an old chat id keep working without a backfill.
-- account_id is the connection, the website site or the public API key the entrance goes through (no foreign key: three tables own those
-- ids), null when the entrance has none. A merge of two contacts is followed at read time through contact_merges (no row is rewritten).
-- EDITED IN PLACE 2026-11-14 by ROAD Opus-1e (coordinator ruling R43; this file was never applied on any database): THE STAFF HOLD is
-- engine data on the route. `held_by_member_id` + `held_at` are set when a member of the shop takes the thread over (the stop card's
-- Take over, a package's "take the thread" action through the engine's port) and cleared by "hand back to the agent"; both null or both
-- set. While a route is held, the customer-send door refuses every AI send to it (`route_held`); a member's typed reply goes. No foreign
-- key on the member (the hold outlives the seat, as the lines' member_id does).
CREATE TABLE public.customer_routes (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    contact_id uuid NOT NULL REFERENCES public.contacts(id),
    channel text NOT NULL,
    account_id uuid,
    held_by_member_id uuid,
    held_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT customer_routes_channel_check CHECK ((char_length(channel) BETWEEN 1 AND 64)),
    CONSTRAINT customer_routes_hold_check CHECK (((held_by_member_id IS NULL) = (held_at IS NULL)))
);

-- One route per person and entrance; a missing account counts as one value (the nil uuid stands for "no account" in the key only).
CREATE UNIQUE INDEX customer_routes_entrance_unique ON public.customer_routes
    USING btree (workspace_id, contact_id, channel, (COALESCE(account_id, '00000000-0000-0000-0000-000000000000'::uuid)));
-- The routes of one person, oldest first.
CREATE INDEX customer_routes_contact ON public.customer_routes USING btree (workspace_id, contact_id, created_at, id);

CREATE TRIGGER customer_routes_set_updated_at BEFORE UPDATE ON public.customer_routes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.customer_routes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_routes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.customer_routes TO app_be;
CREATE POLICY customer_routes_app_be_all ON public.customer_routes TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

-- public.customer_messages (EDITED IN PLACE 2026-11-14 by ROAD Opus-M, owner ruling R26: this file was never applied on any database;
-- the table was `channel_deliveries`, the outbound ledger only). THE CONVERSATION WITH A CUSTOMER, both directions, as engine data: ONE row
-- per line said on a route, what the person said (`from_person`, written once by the engine's one delivery function from the source's pure
-- mapping of its event) and what was said to the person (`to_person`, by ANY agent, the engine's own lines or a member's typed reply: the
-- send's ledger row, written by an atomic insert-or-nothing BEFORE the provider is asked, state `claimed`, settled after `delivered`,
-- `refused` or `unknown`). No plugin keeps a copy of the words. The unknown-outcome rule is unchanged (engine-core rule 9): `claimed` or
-- `unknown` is never sent again by a machine; only a definite `refused` may be claimed again. `said_at` then `seq` is the order of the
-- thread. No blobs: files are addresses. No foreign key on run_id or member_id (the line outlives the run and the seat); a deleted contact
-- keeps its lines (soft delete, R31: hidden from every read by the contact's mark), a removed agent leaves them unattributed.
CREATE TABLE public.customer_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    seq bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    route_id uuid NOT NULL REFERENCES public.customer_routes(id),
    contact_id uuid NOT NULL REFERENCES public.contacts(id),
    direction text NOT NULL,
    line_key text NOT NULL,
    said_at timestamptz NOT NULL,
    text text DEFAULT ''::text NOT NULL,
    files jsonb DEFAULT '[]'::jsonb NOT NULL,
    attachment_count integer DEFAULT 0 NOT NULL,
    attachment_kinds jsonb DEFAULT '[]'::jsonb NOT NULL,
    order_card jsonb,
    event_id text,
    agent_id uuid REFERENCES public.agents(id) ON DELETE SET NULL,
    member_id uuid,
    run_id uuid,
    step_key text,
    state text,
    reason text,
    provider_message_id text,
    channel text NOT NULL,
    account_id uuid,
    delivered_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT customer_messages_direction_check CHECK ((direction = ANY (ARRAY['from_person'::text, 'to_person'::text]))),
    CONSTRAINT customer_messages_line_key_check CHECK ((char_length(line_key) BETWEEN 1 AND 200)),
    CONSTRAINT customer_messages_channel_check CHECK ((char_length(channel) BETWEEN 1 AND 64)),
    CONSTRAINT customer_messages_files_check CHECK ((jsonb_typeof(files) = 'array'::text)),
    CONSTRAINT customer_messages_attachments_check CHECK (((attachment_count >= 0) AND (jsonb_typeof(attachment_kinds) = 'array'::text))),
    CONSTRAINT customer_messages_state_check CHECK ((
        ((direction = 'to_person') AND (state = ANY (ARRAY['claimed'::text, 'delivered'::text, 'refused'::text, 'unknown'::text])))
        OR ((direction = 'from_person') AND (state IS NULL) AND (agent_id IS NULL) AND (member_id IS NULL) AND (run_id IS NULL)
            AND (step_key IS NULL) AND (order_card IS NULL) AND (reason IS NULL) AND (provider_message_id IS NULL))
    )),
    CONSTRAINT customer_messages_delivered_check CHECK (((state = 'delivered') OR (delivered_at IS NULL)))
);

-- The send fence: one send key per workspace (what `claim` and a replay read).
CREATE UNIQUE INDEX customer_messages_send_key ON public.customer_messages USING btree (workspace_id, line_key) WHERE (direction = 'to_person');
-- Once-only of a heard line: the source's own id of the message, once on its route (the webhook and the poll of one message are one row).
CREATE UNIQUE INDEX customer_messages_heard_key ON public.customer_messages USING btree (workspace_id, route_id, line_key) WHERE (direction = 'from_person');
-- The newest window of a route, both directions; of one person (under every route).
CREATE INDEX customer_messages_route_window ON public.customer_messages USING btree (workspace_id, route_id, said_at DESC, seq DESC);
CREATE INDEX customer_messages_contact_window ON public.customer_messages USING btree (workspace_id, contact_id, said_at DESC, seq DESC);
-- What one step of one run already told; what was delivered in a period (the dashboard); the lines of an agent (removal).
CREATE INDEX customer_messages_step ON public.customer_messages USING btree (workspace_id, run_id, step_key) WHERE (run_id IS NOT NULL);
CREATE INDEX customer_messages_delivered ON public.customer_messages USING btree (workspace_id, delivered_at) WHERE (state = 'delivered');
CREATE INDEX customer_messages_agent ON public.customer_messages USING btree (agent_id) WHERE (agent_id IS NOT NULL);

CREATE TRIGGER customer_messages_set_updated_at BEFORE UPDATE ON public.customer_messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.customer_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_messages FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.customer_messages TO app_be;
CREATE POLICY customer_messages_app_be_all ON public.customer_messages TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));
