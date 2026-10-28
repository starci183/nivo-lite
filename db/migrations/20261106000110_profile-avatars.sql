-- v0.3.6: profile pictures of people and agents. The bucket is public so a picture shows by its address, like a provider photo;
-- objects are named by a fresh id in a people/ or agents/ folder, so the bucket says nothing about who they belong to. Nothing in
-- the browser writes the bucket: the back end issues one-time upload addresses and the bucket itself bounds what lands there
-- (PNG, JPEG or WebP of at most 2 MB). Reading is open to everyone, as the public address already is.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars_public', 'avatars_public', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY objects_public_read ON storage.objects AS PERMISSIVE FOR SELECT TO anon, authenticated
    USING (bucket_id = 'avatars_public');

-- A person's uploaded picture is kept under its own metadata key (nivo_avatar_url): Auth rewrites avatar_url from the provider
-- profile on every OAuth sign-in. The uploaded picture wins; the provider photo stays the fallback; both must be HTTPS.
CREATE OR REPLACE FUNCTION be_access.workspace_member_avatars(p_workspace uuid, p_ids uuid[])
RETURNS TABLE(id uuid, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
    SELECT u.id,
           COALESCE(
               CASE WHEN jsonb_typeof(u.raw_user_meta_data -> 'nivo_avatar_url') = 'string'
                         AND u.raw_user_meta_data ->> 'nivo_avatar_url' ~ '^https://'
                    THEN u.raw_user_meta_data ->> 'nivo_avatar_url' END,
               CASE WHEN jsonb_typeof(u.raw_user_meta_data -> 'avatar_url') = 'string'
                         AND u.raw_user_meta_data ->> 'avatar_url' ~ '^https://'
                    THEN u.raw_user_meta_data ->> 'avatar_url' END)
    FROM auth.users u
    JOIN public.workspace_members m ON m.user_id = u.id
    WHERE m.workspace_id = p_workspace AND m.status = 'active' AND u.id = ANY(p_ids);
$$;

REVOKE ALL ON FUNCTION be_access.workspace_member_avatars(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION be_access.workspace_member_avatars(uuid, uuid[]) TO app_be;
