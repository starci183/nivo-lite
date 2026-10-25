import { sql } from "@modules/platform/database"

/** Keeps an uploaded picture on an account the way Auth stores it ($1 user, $2 address). */
export const WRITE_UPLOADED_AVATAR = sql`
    UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('nivo_avatar_url', $2::text)
    WHERE id = $1`

/** The limits the avatars bucket declares. */
export const READ_AVATARS_BUCKET = sql`
    SELECT public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'avatars_public' LIMIT 1`

/** Every storage policy that names the avatars bucket. */
export const READ_AVATARS_POLICIES = sql`
    SELECT policyname, cmd, roles::text[] AS roles
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual LIKE '%avatars_public%' OR with_check LIKE '%avatars_public%')
    ORDER BY policyname
    LIMIT 10`

/** Lets the local role creator enter the signed-in browser role for one rolled-back proof transaction. */
export const ENTER_BROWSER_ROLE = sql`GRANT authenticated TO CURRENT_USER WITH INHERIT FALSE, SET TRUE`

/** Applies the browser role's real grants and policies to the proof. */
export const USE_BROWSER_ROLE = sql`SET LOCAL ROLE authenticated`

/** A browser trying to place an object in the avatars bucket itself ($1 object name). */
export const BROWSER_WRITE_AVATAR = sql`INSERT INTO storage.objects (bucket_id, name) VALUES ('avatars_public', $1)`
