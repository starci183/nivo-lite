-- The account doors of a lite app: the only way app_be reaches auth.users and auth.identities (it holds no grant on schema auth). Eight
-- SECURITY DEFINER functions with a pinned search_path, EXECUTE revoked from public and the browser roles and granted to app_be alone: an
-- account comes back only for an exact address or id, a hash only for an exact address, and no door writes role or app metadata; the hash
-- is written only by a new account and by be_auth_set_password.
-- The text is the canon owner of the doors (templates/app/auth-doors.sql.partial); the back end calls them through persistence/account-doors.port.ts.

-- Looks up an address in lower case; the bootstrap index serves email as written, not lower(email).
create index if not exists users_email_lower_idx on auth.users (lower(email)) where is_anonymous = false;

-- Stamps the confirmation of a mailbox (a spent confirmation link); a mailbox that is already confirmed keeps its date and the sign-in record is untouched.
CREATE FUNCTION public.be_auth_confirm_user(p_user uuid, p_now timestamp with time zone) RETURNS void
    LANGUAGE sql VOLATILE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, p_now), updated_at = p_now where id = p_user;
$$;

-- Sets a new password hash; when p_confirm is true (a spent reset link proved the mailbox) the address is confirmed too.
CREATE FUNCTION public.be_auth_set_password(p_user uuid, p_hash text, p_confirm boolean, p_now timestamp with time zone) RETURNS void
    LANGUAGE sql VOLATILE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  update auth.users
     set encrypted_password = p_hash,
         email_confirmed_at = case when p_confirm then coalesce(email_confirmed_at, p_now) else email_confirmed_at end,
         updated_at = p_now
   where id = p_user;
$$;

REVOKE EXECUTE ON FUNCTION public.be_auth_confirm_user(uuid, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_confirm_user(uuid, timestamp with time zone) TO app_be;
REVOKE EXECUTE ON FUNCTION public.be_auth_set_password(uuid, text, boolean, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_set_password(uuid, text, boolean, timestamp with time zone) TO app_be;
