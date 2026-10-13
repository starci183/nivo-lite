import { MEDIA_MAX_BYTES, MEDIA_MIME, asciiFold } from "@/modules/video"
import type { MediaFileInfo } from "@/modules/video"

/**
 * Shim kept for the content editor (features/module-content/editor.tsx) until that lane stops importing it.
 * The video media rules now live in modules/video; the upload itself goes through modules/db/video.
 */
export type MediaCheck =
    | { readonly ok: true; readonly kind: "image" | "video" }
    | { readonly ok: false; readonly error: "empty" | "too_large" | "unsupported_type" }

/** Checks a file against the media bucket rules (size and type). */
export const checkMediaFile = (file: MediaFileInfo): MediaCheck => {
    if (file.size <= 0) return { ok: false, error: "empty" }
    if (file.size > MEDIA_MAX_BYTES) return { ok: false, error: "too_large" }
    if (!MEDIA_MIME.some((mime) => mime === file.type)) return { ok: false, error: "unsupported_type" }
    return { ok: true, kind: file.type.startsWith("video/") ? "video" : "image" }
}

const safeName = (name: string): string => {
    const dot = name.lastIndexOf(".")
    const ext =
        dot > 0
            ? name
                  .slice(dot + 1)
                  .toLowerCase()
                  .replace(/[^a-z0-9]/g, "")
                  .slice(0, 5)
            : ""
    const stem =
        asciiFold(dot > 0 ? name.slice(0, dot) : name)
            .replace(/[^a-zA-Z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 40) || "file"
    return ext ? `${stem}.${ext}` : stem
}

/** The path "workspace/uuid-name.ext" of a new upload in the media bucket. */
export const buildMediaPath = (workspaceId: string, filename: string): string =>
    `${workspaceId}/${crypto.randomUUID()}-${safeName(filename)}`
