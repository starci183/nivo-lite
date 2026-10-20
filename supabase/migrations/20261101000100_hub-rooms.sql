-- Hub rooms and agent result cards (N17, card frame of N3/N6/N8/N11/N15).
-- Additive only: a workspace without office_rooms keeps the single Office thread unchanged.

-- 1. The room and the result card of a line. room NULL = the general Office room (which shows every line).
ALTER TABLE public.messages ADD COLUMN room text;
ALTER TABLE public.messages ADD COLUMN card jsonb;
ALTER TABLE public.messages ADD CONSTRAINT messages_room_check
    CHECK (room IS NULL OR room = ANY (ARRAY['executive', 'frontdesk', 'sales', 'marketing', 'care', 'accounting']));
ALTER TABLE public.messages ADD CONSTRAINT messages_card_check
    CHECK (card IS NULL OR (
        jsonb_typeof(card) = 'object'
        AND card->>'v' = '1'
        AND card->>'type' = ANY (ARRAY['draft_post', 'video_ready', 'approval_request', 'schedule_confirmed',
                                        'weekly_report', 'booking_held', 'daily_summary', 'handoff_note', 'exception'])
        AND octet_length(card::text) <= 65536));
CREATE INDEX messages_workspace_room_created_idx ON public.messages USING btree (workspace_id, room, created_at DESC);

-- 2. The department rooms of a workspace.
CREATE TABLE public.office_rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    key text NOT NULL,
    name text NOT NULL,
    position integer DEFAULT 0 NOT NULL,
    modules text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT office_rooms_key_check
        CHECK (key = ANY (ARRAY['executive', 'frontdesk', 'sales', 'marketing', 'care', 'accounting'])),
    CONSTRAINT office_rooms_name_check CHECK (char_length(name) BETWEEN 1 AND 60),
    CONSTRAINT office_rooms_workspace_key UNIQUE (workspace_id, key)
);

-- 3. Who sits in a room: people (user_id) and agents (agent_id); an agent's home room receives its lines.
CREATE TABLE public.office_rooms_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    room_id uuid NOT NULL REFERENCES public.office_rooms(id) ON DELETE CASCADE,
    agent_id uuid REFERENCES public.agents(id) ON DELETE CASCADE,
    user_id uuid,
    is_home boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT office_rooms_members_one_kind CHECK ((agent_id IS NULL) <> (user_id IS NULL))
);
CREATE UNIQUE INDEX office_rooms_members_agent ON public.office_rooms_members (room_id, agent_id) WHERE agent_id IS NOT NULL;
CREATE UNIQUE INDEX office_rooms_members_user ON public.office_rooms_members (room_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX office_rooms_members_home ON public.office_rooms_members (agent_id) WHERE is_home;

-- 4. Documents pinned in a room.
CREATE TABLE public.office_rooms_pins (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    room_id uuid NOT NULL REFERENCES public.office_rooms(id) ON DELETE CASCADE,
    title text NOT NULL,
    href text,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT office_rooms_pins_title_check CHECK (char_length(title) BETWEEN 1 AND 160)
);

-- 5. Where each person last read each room ('' = the Office room), for the unread counts.
CREATE TABLE public.office_rooms_reads (
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    room text NOT NULL,
    last_read_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (workspace_id, user_id, room)
);

ALTER TABLE public.office_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_rooms_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_rooms_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_rooms_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY office_rooms_app_be_select ON public.office_rooms FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY office_rooms_app_be_insert ON public.office_rooms FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY office_rooms_app_be_update ON public.office_rooms FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY office_rooms_app_be_delete ON public.office_rooms FOR DELETE TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY office_rooms_members_app_be_select ON public.office_rooms_members FOR SELECT TO app_be USING (room_id IS NOT NULL);
CREATE POLICY office_rooms_members_app_be_insert ON public.office_rooms_members FOR INSERT TO app_be WITH CHECK (room_id IS NOT NULL);
CREATE POLICY office_rooms_members_app_be_update ON public.office_rooms_members FOR UPDATE TO app_be USING (room_id IS NOT NULL) WITH CHECK (room_id IS NOT NULL);
CREATE POLICY office_rooms_members_app_be_delete ON public.office_rooms_members FOR DELETE TO app_be USING (room_id IS NOT NULL);
CREATE POLICY office_rooms_pins_app_be_select ON public.office_rooms_pins FOR SELECT TO app_be USING (room_id IS NOT NULL);
CREATE POLICY office_rooms_pins_app_be_insert ON public.office_rooms_pins FOR INSERT TO app_be WITH CHECK (room_id IS NOT NULL);
CREATE POLICY office_rooms_pins_app_be_update ON public.office_rooms_pins FOR UPDATE TO app_be USING (room_id IS NOT NULL) WITH CHECK (room_id IS NOT NULL);
CREATE POLICY office_rooms_pins_app_be_delete ON public.office_rooms_pins FOR DELETE TO app_be USING (room_id IS NOT NULL);
CREATE POLICY office_rooms_reads_app_be_select ON public.office_rooms_reads FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY office_rooms_reads_app_be_insert ON public.office_rooms_reads FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY office_rooms_reads_app_be_update ON public.office_rooms_reads FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY office_rooms_reads_app_be_delete ON public.office_rooms_reads FOR DELETE TO app_be USING (workspace_id IS NOT NULL);
GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.office_rooms TO app_be;
GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.office_rooms_members TO app_be;
GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.office_rooms_pins TO app_be;
GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE public.office_rooms_reads TO app_be;

-- 6. Creates the six department rooms of a workspace (idempotent), seats each active agent in the room of its module and
-- answers how many rooms it opened.
CREATE FUNCTION public.ensure_office_rooms(p_workspace uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_opened integer;
begin
  insert into public.office_rooms (workspace_id, key, name, position, modules) values
    (p_workspace, 'executive', 'Ban điều hành', 6, '{}'),
    (p_workspace, 'frontdesk', 'Lễ tân', 1, '{}'),
    (p_workspace, 'sales', 'Sales', 2, '{sales,booking}'),
    (p_workspace, 'marketing', 'Marketing', 3, '{content,video}'),
    (p_workspace, 'care', 'CSKH', 4, '{chatbot}'),
    (p_workspace, 'accounting', 'Kế toán', 5, '{accounting,invoices}')
  on conflict (workspace_id, key) do nothing;
  get diagnostics v_opened = row_count;
  insert into public.office_rooms_members (room_id, agent_id, is_home)
  select r.id, a.id, not exists (select 1 from public.office_rooms_members h where h.agent_id = a.id and h.is_home)
  from public.agents a
  join public.office_rooms r on r.workspace_id = a.workspace_id and a.module = any (r.modules)
  where a.workspace_id = p_workspace and a.status = 'active'
    and not exists (select 1 from public.office_rooms_members m where m.agent_id = a.id)
  on conflict do nothing;
  return v_opened;
end $$;
REVOKE ALL ON FUNCTION public.ensure_office_rooms(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_office_rooms(uuid) TO app_be;

-- 7. Routes a line whose writer left the room empty: the room of the "@agent" command that made its work item, else the
-- speaking agent's home room, else the room of the work item's department; otherwise it stays in the Office only.
CREATE FUNCTION public.messages_route_room() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if new.room is not null then
    return new;
  end if;
  if new.work_item_id is not null then
    select m.room into new.room
    from public.office_command_candidates c
    join public.messages m on m.id = c.message_id
    where c.work_item_id = new.work_item_id and c.workspace_id = new.workspace_id and m.room is not null
    limit 1;
  end if;
  if new.room is null and new.agent_id is not null then
    select r.key into new.room
    from public.office_rooms_members rm
    join public.office_rooms r on r.id = rm.room_id
    where rm.agent_id = new.agent_id and rm.is_home and r.workspace_id = new.workspace_id
    limit 1;
  end if;
  if new.room is null and new.work_item_id is not null then
    select r.key into new.room
    from public.work_items w
    join public.office_rooms r on r.workspace_id = w.workspace_id and w.department = any (r.modules)
    where w.id = new.work_item_id and w.workspace_id = new.workspace_id
    order by r.position
    limit 1;
  end if;
  return new;
end $$;

CREATE TRIGGER messages_route_room BEFORE INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.messages_route_room();

-- 8. Records that a person read a room up to now ('' = the Office room).
CREATE FUNCTION public.mark_office_room_read(p_workspace uuid, p_user uuid, p_room text) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
    insert into public.office_rooms_reads (workspace_id, user_id, room, last_read_at)
    values (p_workspace, p_user, p_room, now())
    on conflict (workspace_id, user_id, room) do update set last_read_at = now()
$$;
REVOKE ALL ON FUNCTION public.mark_office_room_read(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_office_room_read(uuid, uuid, text) TO app_be;
