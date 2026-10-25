-- Read only the existing provider photos of active members of the selected workspace.
-- Like be_access.user_emails, this keeps Auth tables private to their owner.
CREATE FUNCTION be_access.workspace_member_avatars(p_workspace uuid, p_ids uuid[])
RETURNS TABLE(id uuid, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
    SELECT u.id,
           CASE WHEN jsonb_typeof(u.raw_user_meta_data -> 'avatar_url') = 'string'
                THEN u.raw_user_meta_data ->> 'avatar_url' ELSE NULL END
    FROM auth.users u
    JOIN public.workspace_members m ON m.user_id = u.id
    WHERE m.workspace_id = p_workspace AND m.status = 'active' AND u.id = ANY(p_ids);
$$;

REVOKE ALL ON FUNCTION be_access.workspace_member_avatars(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION be_access.workspace_member_avatars(uuid, uuid[]) TO app_be;
