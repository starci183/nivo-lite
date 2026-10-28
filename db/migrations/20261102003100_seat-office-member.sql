-- Seats a workspace member in a department room (the Hub rooms owner writes its own table). `cli seed-workspace office` calls it
-- after ensure_office_rooms so the people of a story sit where the agents they may give work to are open to them. It runs with the
-- caller's rights: the app_be grants and policies of office_rooms_members apply. Answers false when the room is not of the
-- workspace or the user is not a member of it, true once the member sits in the room (seated already is not an error).
CREATE FUNCTION public.seat_office_member(p_workspace uuid, p_room text, p_user uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY INVOKER
    SET search_path TO 'public'
    AS $$
declare
  v_room uuid;
begin
  select r.id into v_room from public.office_rooms r where r.workspace_id = p_workspace and r.key = p_room;
  if v_room is null then return false; end if;
  if not exists (select 1 from public.workspace_members m where m.workspace_id = p_workspace and m.user_id = p_user) then
    return false;
  end if;
  insert into public.office_rooms_members (room_id, user_id) values (v_room, p_user)
  on conflict (room_id, user_id) where user_id is not null do nothing;
  return true;
end $$;
REVOKE ALL ON FUNCTION public.seat_office_member(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seat_office_member(uuid, text, uuid) TO app_be;
