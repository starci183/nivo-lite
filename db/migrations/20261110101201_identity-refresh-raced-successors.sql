-- identity-refresh-raced-successors: forward-only; immutable once on origin/main.
-- A refresh token presented again within the grace window after its rotation (a racing request, or a browser whose earlier Set-Cookie
-- never arrived) now gets a successor of its own, set as the cookie, instead of an access token that leaves the browser on a spent token.
-- raced_count bounds how many such successors one rotated token may obtain; beyond it the replay is reuse and ends the session.
-- Expand only: one column with a default, nothing existing altered.

ALTER TABLE public.identity_refresh_tokens ADD COLUMN raced_count integer NOT NULL DEFAULT 0;
