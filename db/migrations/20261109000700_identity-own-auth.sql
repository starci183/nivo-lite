-- Lite edition auth: the back end now signs people in itself (Google and email/password) instead of Supabase Auth. Additive: two new tables for
-- rotating refresh tokens and single-use password tokens, plus SECURITY DEFINER doors over the existing auth.users / auth.identities / auth.sessions
-- tables (kept GoTrue-compatible, so every FK, trigger and restored row stays valid). app_be gets no direct grant on the auth schema, as before.

CREATE TABLE public.identity_refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    session_id uuid NOT NULL REFERENCES auth.sessions(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    CONSTRAINT identity_refresh_tokens_hash_key UNIQUE (token_hash)
);
CREATE INDEX identity_refresh_tokens_session_idx ON public.identity_refresh_tokens USING btree (session_id);
CREATE INDEX identity_refresh_tokens_expiry_idx ON public.identity_refresh_tokens USING btree (expires_at);

CREATE TABLE public.identity_password_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash text NOT NULL,
    purpose text NOT NULL,
    created_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    CONSTRAINT identity_password_tokens_hash_key UNIQUE (token_hash),
    CONSTRAINT identity_password_tokens_purpose_check CHECK (purpose IN ('reset', 'invite', 'confirm'))
);
CREATE INDEX identity_password_tokens_user_idx ON public.identity_password_tokens USING btree (user_id, created_at DESC);

ALTER TABLE public.identity_refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_password_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.identity_refresh_tokens FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.identity_password_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.identity_refresh_tokens TO app_be;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.identity_password_tokens TO app_be;

-- The dedicated backend principal must be active, including through an inherited app_be role.
CREATE POLICY identity_refresh_tokens_app_be ON public.identity_refresh_tokens
    FOR ALL TO app_be USING (current_user = 'app_be') WITH CHECK (current_user = 'app_be');
CREATE POLICY identity_password_tokens_app_be ON public.identity_password_tokens
    FOR ALL TO app_be USING (current_user = 'app_be') WITH CHECK (current_user = 'app_be');

-- A person by sign-in address (lower-cased), with the stored bcrypt hash so the back end can verify it.
CREATE FUNCTION public.be_auth_user_by_email(p_email text)
    RETURNS TABLE(id uuid, email text, encrypted_password text, email_confirmed_at timestamp with time zone, disabled boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select u.id, u.email::text, u.encrypted_password::text, u.email_confirmed_at,
         (u.deleted_at is not null or (u.banned_until is not null and u.banned_until > now()))
    from auth.users u
   where lower(u.email) = p_email and u.is_anonymous = false
   order by u.created_at asc nulls last
   limit 1;
$$;

-- One person by id.
CREATE FUNCTION public.be_auth_user_by_id(p_user uuid)
    RETURNS TABLE(id uuid, email text, last_sign_in_at timestamp with time zone, meta jsonb, disabled boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select u.id, u.email::text, u.last_sign_in_at, coalesce(u.raw_user_meta_data, '{}'::jsonb),
         (u.deleted_at is not null or (u.banned_until is not null and u.banned_until > now()))
    from auth.users u where u.id = p_user;
$$;

-- The person a Google account is linked to, if any.
CREATE FUNCTION public.be_auth_user_by_google(p_provider_id text) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select i.user_id from auth.identities i where i.provider = 'google' and i.provider_id = p_provider_id limit 1;
$$;

-- Creates a person; a null hash is an invited or Google-only account that has no password yet.
CREATE FUNCTION public.be_auth_create_user(p_id uuid, p_email text, p_hash text, p_confirmed boolean, p_meta jsonb, p_now timestamp with time zone)
    RETURNS uuid
    LANGUAGE sql VOLATILE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email, p_hash,
          case when p_confirmed then p_now end, case when p_hash is null and not p_confirmed then p_now end,
          '{"provider":"email","providers":["email"]}'::jsonb, p_meta, p_now, p_now)
  returning id;
$$;

-- Links a Google account to a person.
CREATE FUNCTION public.be_auth_link_google(p_user uuid, p_provider_id text, p_data jsonb, p_now timestamp with time zone) RETURNS void
    LANGUAGE sql VOLATILE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (p_provider_id, p_user, p_data, 'google', p_now, p_now, p_now)
  on conflict (provider_id, provider) do update set last_sign_in_at = p_now, updated_at = p_now;
$$;

-- Records a sign-in; a verified Google address also confirms the mailbox; profile keys only fill what the person has not set.
CREATE FUNCTION public.be_auth_touch_user(p_user uuid, p_now timestamp with time zone, p_confirm boolean, p_meta jsonb) RETURNS void
    LANGUAGE sql VOLATILE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  update auth.users
     set last_sign_in_at = p_now,
         updated_at = p_now,
         email_confirmed_at = case when p_confirm then coalesce(email_confirmed_at, p_now) else email_confirmed_at end,
         raw_user_meta_data = p_meta || coalesce(raw_user_meta_data, '{}'::jsonb)
   where id = p_user;
$$;

-- Sets a new password hash; proving the mailbox through a mailed token also confirms the address.
CREATE FUNCTION public.be_auth_set_password(p_user uuid, p_hash text, p_now timestamp with time zone) RETURNS void
    LANGUAGE sql VOLATILE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  update auth.users
     set encrypted_password = p_hash, email_confirmed_at = coalesce(email_confirmed_at, p_now), updated_at = p_now
   where id = p_user;
$$;

-- Keeps (or with null drops) the picture the person uploaded.
CREATE FUNCTION public.be_auth_set_avatar(p_user uuid, p_url text) RETURNS boolean
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare changed int;
begin
  update auth.users
     set raw_user_meta_data = case when p_url is null then coalesce(raw_user_meta_data, '{}'::jsonb) - 'nivo_avatar_url'
                                   else coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('nivo_avatar_url', p_url) end
   where id = p_user;
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

-- Opens a device session; the refresh tokens hang on it, and be_revoke_session already ends it.
CREATE FUNCTION public.be_auth_open_session(p_id uuid, p_user uuid, p_now timestamp with time zone, p_agent text, p_ip text) RETURNS void
    LANGUAGE sql VOLATILE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  insert into auth.sessions (id, user_id, created_at, updated_at, refreshed_at, user_agent, ip)
  values (p_id, p_user, p_now, p_now, (p_now at time zone 'utc'), left(p_agent, 512), p_ip::inet);
$$;

-- Marks a session active now.
CREATE FUNCTION public.be_auth_touch_session(p_session uuid, p_now timestamp with time zone) RETURNS boolean
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare changed int;
begin
  update auth.sessions set updated_at = p_now, refreshed_at = (p_now at time zone 'utc') where id = p_session;
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;

-- Ends a session; its refresh tokens go with it.
CREATE FUNCTION public.be_auth_close_session(p_session uuid) RETURNS boolean
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare removed int;
begin
  delete from auth.sessions where id = p_session;
  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;

-- Confirms the mailbox of a person who spent a signup link.
CREATE FUNCTION public.be_auth_confirm_email(p_user uuid, p_now timestamp with time zone) RETURNS void
    LANGUAGE sql VOLATILE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, p_now), updated_at = p_now where id = p_user;
$$;

-- Ends every session of a person except the one they keep (sign out of other devices).
CREATE FUNCTION public.be_auth_close_other_sessions(p_user uuid, p_keep uuid) RETURNS integer
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare removed int;
begin
  delete from auth.sessions where user_id = p_user and id <> p_keep;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- Ends every session of a person (after a password reset); their refresh tokens go with them.
CREATE FUNCTION public.be_auth_close_user_sessions(p_user uuid) RETURNS integer
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare removed int;
begin
  delete from auth.sessions where user_id = p_user;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

REVOKE EXECUTE ON FUNCTION public.be_auth_user_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_user_by_email(text) TO app_be;
REVOKE EXECUTE ON FUNCTION public.be_auth_user_by_id(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_user_by_id(uuid) TO app_be;
REVOKE EXECUTE ON FUNCTION public.be_auth_user_by_google(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_user_by_google(text) TO app_be;
REVOKE EXECUTE ON FUNCTION public.be_auth_create_user(uuid, text, text, boolean, jsonb, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_create_user(uuid, text, text, boolean, jsonb, timestamp with time zone) TO app_be;
REVOKE EXECUTE ON FUNCTION public.be_auth_link_google(uuid, text, jsonb, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_link_google(uuid, text, jsonb, timestamp with time zone) TO app_be;
REVOKE EXECUTE ON FUNCTION public.be_auth_touch_user(uuid, timestamp with time zone, boolean, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_touch_user(uuid, timestamp with time zone, boolean, jsonb) TO app_be;
REVOKE EXECUTE ON FUNCTION public.be_auth_set_password(uuid, text, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_set_password(uuid, text, timestamp with time zone) TO app_be;
REVOKE EXECUTE ON FUNCTION public.be_auth_set_avatar(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_set_avatar(uuid, text) TO app_be;
REVOKE EXECUTE ON FUNCTION public.be_auth_open_session(uuid, uuid, timestamp with time zone, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_open_session(uuid, uuid, timestamp with time zone, text, text) TO app_be;
REVOKE EXECUTE ON FUNCTION public.be_auth_touch_session(uuid, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_touch_session(uuid, timestamp with time zone) TO app_be;
REVOKE EXECUTE ON FUNCTION public.be_auth_close_session(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_close_session(uuid) TO app_be;
REVOKE EXECUTE ON FUNCTION public.be_auth_close_user_sessions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_close_user_sessions(uuid) TO app_be;
REVOKE EXECUTE ON FUNCTION public.be_auth_confirm_email(uuid, timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_confirm_email(uuid, timestamp with time zone) TO app_be;
REVOKE EXECUTE ON FUNCTION public.be_auth_close_other_sessions(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_auth_close_other_sessions(uuid, uuid) TO app_be;
