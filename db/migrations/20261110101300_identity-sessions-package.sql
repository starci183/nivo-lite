-- Sign-in moves to the @starci/auth package, which owns the device-session and refresh-token tables (public.identity_sessions,
-- public.identity_refresh_tokens). The refresh tokens keep their rows and columns; their sessions move out of GoTrue's auth.sessions into
-- public.identity_sessions, so every live session and every refresh token stays valid: the signing key, issuer, claims, key id and cookie
-- names do not change, and a session id keeps its value.
--
-- The tables of the package. Text of @starci/auth migrations/identity-sessions.sql (identity_sessions part; identity_refresh_tokens exists and
-- is kept below; the sign-in counter is the shared rate-limit store, so identity_attempts is not created).
CREATE TABLE public.identity_sessions (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    refreshed_at timestamptz NOT NULL DEFAULT now(),
    user_agent text,
    ip text
);

CREATE INDEX identity_sessions_user_idx ON public.identity_sessions (user_id);

ALTER TABLE public.identity_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_sessions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.identity_sessions FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.identity_sessions TO app_be;
CREATE POLICY identity_sessions_app_be_all ON public.identity_sessions
    FOR ALL TO app_be USING (current_user = 'app_be') WITH CHECK (current_user = 'app_be');

-- Nobody opens a token while the sessions move.
LOCK TABLE public.identity_refresh_tokens IN SHARE ROW EXCLUSIVE MODE;

-- Backfill: the session of every refresh token (the live sign-ins). GoTrue sessions that no refresh token hangs on cannot sign anyone in and stay
-- in auth.sessions, untouched.
INSERT INTO public.identity_sessions (id, user_id, created_at, refreshed_at, user_agent, ip)
SELECT s.id,
       s.user_id,
       coalesce(s.created_at, now()),
       coalesce(s.refreshed_at AT TIME ZONE 'utc', s.updated_at, s.created_at, now()),
       s.user_agent,
       host(s.ip)
  FROM auth.sessions s
 WHERE s.id IN (SELECT t.session_id FROM public.identity_refresh_tokens t);

-- The refresh tokens now hang on the package's sessions (a closed session still takes its tokens with it).
DO $$
DECLARE
    old_fk text;
BEGIN
    SELECT c.conname INTO old_fk
      FROM pg_constraint c
     WHERE c.conrelid = 'public.identity_refresh_tokens'::regclass
       AND c.contype = 'f'
       AND c.confrelid = 'auth.sessions'::regclass;
    IF old_fk IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.identity_refresh_tokens DROP CONSTRAINT %I', old_fk);
    END IF;
END
$$;

ALTER TABLE public.identity_refresh_tokens
    ADD CONSTRAINT identity_refresh_tokens_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES public.identity_sessions (id) ON DELETE CASCADE;

-- The account area lists and revokes the person's own sessions from the package table. The tables force row level security for app_be only, so
-- these run as the caller (app_be) instead of as their owner.
CREATE OR REPLACE FUNCTION public.be_account_sessions(p_user uuid)
    RETURNS TABLE(id uuid, created_at timestamp with time zone, last_active_at timestamp with time zone, user_agent text, ip text)
    LANGUAGE sql STABLE SECURITY INVOKER
    SET search_path TO ''
    AS $$
  select s.id, s.created_at, s.refreshed_at as last_active_at, s.user_agent, s.ip
    from public.identity_sessions s
   where s.user_id = p_user
   order by 3 desc nulls last
   limit 100;
$$;

CREATE OR REPLACE FUNCTION public.be_revoke_session(p_user uuid, p_session uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY INVOKER
    SET search_path TO ''
    AS $$
declare removed int;
begin
  delete from public.identity_sessions s where s.id = p_session and s.user_id = p_user;
  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;

-- The back end writes the package tables itself now; the doors over auth.sessions have no caller left.
DROP FUNCTION public.be_auth_open_session(uuid, uuid, timestamp with time zone, text, text);
DROP FUNCTION public.be_auth_touch_session(uuid, timestamp with time zone);
DROP FUNCTION public.be_auth_close_session(uuid);
DROP FUNCTION public.be_auth_close_other_sessions(uuid, uuid);
DROP FUNCTION public.be_auth_close_user_sessions(uuid);
