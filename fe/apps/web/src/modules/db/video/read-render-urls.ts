import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../../../../../../supabase/types/database.types"
import { MEDIA_BUCKET, VIDEOS_BUCKET } from "@/modules/video"
import { downloadNameOf } from "./video.mapper"
import type { RenderRow, RenderUrls } from "./video.mapper"

/** How long a preview or playback link lives, in seconds. */
const LINK_TTL_SECONDS = 3600

/** How long a link sent to the owner lives, in seconds (three days). */
const SHARE_TTL_SECONDS = 3 * 24 * 3600

/** The signed links of a finished render: playback, a download that saves under the project name, and the poster. */
export const signRenderUrls = async (
    client: SupabaseClient<Database>,
    render: RenderRow,
    title: string,
): Promise<RenderUrls> => {
    if (render.status !== "done" || render.output_path === null) {
        return { videoUrl: null, downloadUrl: null, posterUrl: null }
    }
    const bucket = client.storage.from(VIDEOS_BUCKET)
    const [video, download, poster] = await Promise.all([
        bucket.createSignedUrl(render.output_path, LINK_TTL_SECONDS),
        bucket.createSignedUrl(render.output_path, LINK_TTL_SECONDS, { download: downloadNameOf(title) }),
        render.poster_path === null ? null : bucket.createSignedUrl(render.poster_path, LINK_TTL_SECONDS),
    ])
    return {
        videoUrl: video.data?.signedUrl ?? null,
        downloadUrl: download.data?.signedUrl ?? null,
        posterUrl: poster?.data?.signedUrl ?? null,
    }
}

/** A link for the owner to download a render (several days, saved as video.mp4). */
export const signShareUrl = async (client: SupabaseClient<Database>, outputPath: string): Promise<string | null> => {
    const signed = await client.storage
        .from(VIDEOS_BUCKET)
        .createSignedUrl(outputPath, SHARE_TTL_SECONDS, { download: "video.mp4" })
    return signed.data?.signedUrl ?? null
}

/** Short-lived preview links for files of the media bucket, by path. */
export const signMediaUrls = async (
    client: SupabaseClient<Database>,
    paths: ReadonlyArray<string>,
): Promise<ReadonlyMap<string, string>> => {
    if (paths.length === 0) return new Map()
    const signed = await client.storage.from(MEDIA_BUCKET).createSignedUrls([...paths], LINK_TTL_SECONDS)
    const pairs = (signed.data ?? []).flatMap((entry): Array<[string, string]> =>
        entry.path === null || entry.signedUrl === null ? [] : [[entry.path, entry.signedUrl]],
    )
    return new Map(pairs)
}
