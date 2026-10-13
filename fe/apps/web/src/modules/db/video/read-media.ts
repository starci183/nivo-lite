import "server-only"

import { MEDIA_BUCKET, mediaKindOf, mediaLabel } from "@/modules/video"
import type { MediaItem } from "@/modules/video"
import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { signMediaUrls } from "./read-render-urls"

/** The most files the media picker lists. */
const MEDIA_LIMIT = 60

/** Reads what the workspace uploaded to the media bucket (newest first) with short-lived preview links. */
export const readMedia = async (workspaceId: string): Promise<DbOutcome<ReadonlyArray<MediaItem>>> => {
    const client = await createServerDbClient()
    const listed = await client.storage
        .from(MEDIA_BUCKET)
        .list(workspaceId, { limit: MEDIA_LIMIT, sortBy: { column: "created_at", order: "desc" } })
    if (listed.error !== null) return dbFailure("unavailable", "media-list")
    const paths = listed.data
        .filter((file) => file.id !== null && /\.(jpe?g|png|webp|mp4|mov|webm)$/i.test(file.name))
        .map((file) => `${workspaceId}/${file.name}`)
    const urls = await signMediaUrls(client, paths)
    return dbOk(
        paths.map((path) => ({
            path,
            name: mediaLabel(path),
            kind: mediaKindOf(path),
            url: urls.get(path) ?? null,
        })),
    )
}
