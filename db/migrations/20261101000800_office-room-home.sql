-- Moves the home seat of an agent to a department room. `cli seed-workspace profile` calls it after ensure_office_rooms so a
-- workspace profile can seat an agent in a room other than the one its module maps to (a chatbot agent that cares for staying
-- guests sits in CSKH, not Sales). It runs with the caller's rights: the app_be grants and policies of office_rooms_members apply.
-- Answers false when the room or the agent is not of the workspace, true once the agent's home is that room.
CREATE FUNCTION public.move_office_agent_home(p_workspace uuid, p_room text, p_agent uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY INVOKER
    SET search_path TO 'public'
    AS $$
declare
  v_room uuid;
begin
  select r.id into v_room from public.office_rooms r where r.workspace_id = p_workspace and r.key = p_room;
  if v_room is null then return false; end if;
  if not exists (select 1 from public.agents a where a.id = p_agent and a.workspace_id = p_workspace) then return false; end if;
  if exists (select 1 from public.office_rooms_members m where m.room_id = v_room and m.agent_id = p_agent and m.is_home) then
    return true;
  end if;
  delete from public.office_rooms_members m where m.agent_id = p_agent and m.is_home and m.room_id <> v_room;
  insert into public.office_rooms_members (room_id, agent_id, is_home) values (v_room, p_agent, true)
  on conflict (room_id, agent_id) where agent_id is not null do update set is_home = true;
  return true;
end $$;
REVOKE ALL ON FUNCTION public.move_office_agent_home(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.move_office_agent_home(uuid, text, uuid) TO app_be;
