-- Operator account doors (the workspace seed and cleanup commands): list people and delete one, in the same SECURITY DEFINER style as the
-- be_auth_* doors of the own-auth migration, so the cli needs no Supabase Auth admin client. Creating a person reuses be_auth_create_user.

-- One bounded page of people, oldest first. The page starts at 1 and holds 1 to 1000 people.
CREATE FUNCTION public.be_auth_list_users(p_page integer, p_per_page integer)
    RETURNS TABLE(id uuid, email text, meta jsonb)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select u.id, u.email::text, coalesce(u.raw_user_meta_data, '{}'::jsonb)
    from auth.users u
   where u.is_anonymous = false
   order by u.created_at asc nulls last, u.id asc
  offset (greatest(coalesce(p_page, 1), 1) - 1) * least(greatest(coalesce(p_per_page, 50), 1), 1000)
   limit least(greatest(coalesce(p_per_page, 50), 1), 1000);
$$;

-- Deletes a person for good; their sessions, identities and password tokens go with them. Answers whether a person was deleted.
CREATE FUNCTION public.be_auth_delete_user(p_user uuid) RETURNS boolean
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare removed int;
begin
  delete from auth.users where id = p_user;
  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;

REVOKE EXECUTE ON FUNCTION public.be_auth_list_users(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_list_users(integer, integer) TO app_be;
REVOKE EXECUTE ON FUNCTION public.be_auth_delete_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_delete_user(uuid) TO app_be;
