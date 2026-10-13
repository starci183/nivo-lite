import "server-only"

import { createServerDbClient } from "../server"
import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import {
    CONTENT_MEDIA_BUCKET,
    displayName,
    isListableMedia,
    type ContentItem,
    type MediaRef,
    type SignedUrls,
    type VideoOption,
} from "@/modules/content"

const SIGN_SECONDS = 3600
const URL_LIMIT = 80
const VIDEO_BUCKET = "videos"

/** What the editor can attach and how to show it. */
export interface ContentMediaData {
    readonly library: ReadonlyArray<MediaRef>
    readonly videos: ReadonlyArray<VideoOption>
    readonly urls: Readonly<Record<string, SignedUrls>>
}

/** The pictures and videos in the media folder of a workspace, newest first. */
export const readMediaLibrary = async (
    workspaceId: string,
    limit = 30,
): Promise<DbOutcome<ReadonlyArray<MediaRef>>> => {
    const client = await createServerDbClient()
    const files = toOutcome(
        await client.storage
            .from(CONTENT_MEDIA_BUCKET)
            .list(workspaceId, { limit, sortBy: { column: "created_at", order: "desc" } }),
    )
    if (files.kind !== "ok") return files
    return dbOk(
        files.value
            .filter((f) => f.name !== "" && !f.name.endsWith("/") && isListableMedia(f.name))
            .map((f) => ({ kind: "media" as const, path: `${workspaceId}/${f.name}`, name: displayName(f.name) })),
    )
}

const withDownload = (url: string, file: string): string =>
    `${url}${url.includes("?") ? "&" : "?"}download=${encodeURIComponent(file)}`

const readVideoRows = async (workspaceId: string) => {
    const client = await createServerDbClient()
    return toOutcome(
        await client
            .from("video_renders")
            .select("id, spec, output_path, duration_ms, created_at")
            .eq("workspace_id", workspaceId)
            .eq("status", "done")
            .order("created_at", { ascending: false })
            .limit(10),
    )
}

const titleOf = (spec: unknown): string => {
    if (typeof spec !== "object" || spec === null) return ""
    const title = Object.entries(spec).find(([key]) => key === "title")?.[1]
    return typeof title === "string" ? title.trim() : ""
}

/** The library, the attachable videos and short-lived URLs for everything on screen (media of the posts, library, videos). */
export const readContentMedia = async (
    workspaceId: string,
    items: ReadonlyArray<ContentItem>,
): Promise<DbOutcome<ContentMediaData>> => {
    const client = await createServerDbClient()
    const [library, videoRows] = await Promise.all([readMediaLibrary(workspaceId), readVideoRows(workspaceId)])
    const files = library.kind === "ok" ? library.value : []
    const renders = videoRows.kind === "ok" ? videoRows.value.filter((v) => v.output_path !== null) : []
    const videos = renders.map((v) => ({
        id: v.id,
        name: titleOf(v.spec) || "Video",
        createdAt: v.created_at,
        durationMs: v.duration_ms,
    }))
    const paths = [
        ...new Set([
            ...items.flatMap((i) => i.media.flatMap((m) => (m.kind === "media" && m.path ? [m.path] : []))),
            ...files.flatMap((m) => (m.path ? [m.path] : [])),
        ]),
    ].slice(0, URL_LIMIT)
    const signed =
        paths.length > 0
            ? await client.storage.from(CONTENT_MEDIA_BUCKET).createSignedUrls(paths, SIGN_SECONDS)
            : { data: [], error: null }
    const fileUrls = (signed.data ?? []).flatMap((s) =>
        s.signedUrl && s.path
            ? [
                  [
                      s.path,
                      {
                          view: s.signedUrl,
                          download: withDownload(s.signedUrl, displayName(s.path.split("/").pop() ?? "file")),
                      },
                  ] as const,
              ]
            : [],
    )
    const wanted = new Set(
        items.flatMap((i) => i.media.flatMap((m) => (m.kind === "video_render" && m.id ? [m.id] : []))),
    )
    const videoUrls = await Promise.all(
        renders.map(async (v) => {
            if (v.output_path === null || !wanted.has(v.id)) return []
            const url = await client.storage.from(VIDEO_BUCKET).createSignedUrl(v.output_path, SIGN_SECONDS)
            const link = url.data?.signedUrl
            return link
                ? [
                      [
                          `video:${v.id}`,
                          { view: link, download: withDownload(link, `${titleOf(v.spec) || "video"}.mp4`) },
                      ] as const,
                  ]
                : []
        }),
    )
    return dbOk({ library: files, videos, urls: Object.fromEntries([...fileUrls, ...videoUrls.flat()]) })
}
