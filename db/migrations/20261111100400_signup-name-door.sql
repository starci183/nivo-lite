-- Sign-up keeps the full name the person typed (the template sign-up door takes the address and the password only). Right after the
-- sign-up door answered, the web form calls the public setSignupName mutation, which reaches this door: it writes the profile key
-- full_name of an account whose mailbox is still unconfirmed and that has no name yet, and answers whether it did. It never touches a
-- confirmed account, a name already set or any other key, so it cannot rename a person who exists; the caller always answers the same.
CREATE FUNCTION public.be_auth_set_signup_name(p_email text, p_name text) RETURNS boolean
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare changed int;
begin
  update auth.users u
     set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', p_name),
         updated_at = now()
   where lower(u.email) = p_email
     and u.is_anonymous = false
     and u.email_confirmed_at is null
     and coalesce(u.raw_user_meta_data ->> 'full_name', '') = '';
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

REVOKE EXECUTE ON FUNCTION public.be_auth_set_signup_name(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_set_signup_name(text, text) TO app_be;
