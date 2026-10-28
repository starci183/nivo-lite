-- v0.3.6: an agent carries an optional picture next to its display name, like a person's profile photo. Only an HTTPS address is
-- kept, the same rule be_access.workspace_member_avatars (20261104000500) applies to people; null draws the generated avatar.
-- Additive: existing agents keep no picture and every reader treats the column as optional.

ALTER TABLE public.agents
    ADD COLUMN avatar_url text,
    ADD CONSTRAINT agents_avatar_url_https_check
        CHECK (avatar_url IS NULL OR (avatar_url ~ '^https://' AND char_length(avatar_url) <= 2048));
