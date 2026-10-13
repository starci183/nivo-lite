/** The private bucket media files live in. */
export const CONTENT_MEDIA_BUCKET = "media"

/** The largest media file, in bytes. */
export const CONTENT_MEDIA_MAX_BYTES = 10 * 1024 * 1024

/** The accepted media types. */
export const CONTENT_MEDIA_MIME: ReadonlyArray<string> = ["image/jpeg", "image/png", "image/webp", "video/mp4"]

/** The facts about a file the check needs. */
export interface ContentMediaFile {
    readonly name: string
    readonly type: string
    readonly size: number
}

/** Whether a file may be uploaded as post media. */
export const isAcceptedMedia = (file: ContentMediaFile): boolean =>
    file.size > 0 && file.size <= CONTENT_MEDIA_MAX_BYTES && CONTENT_MEDIA_MIME.includes(file.type)

const COMBINING_MARKS = new RegExp("[\u0300-\u036f]", "g")
const D_STROKE = new RegExp(String.fromCodePoint(0x111), "gi")

/** An ASCII, URL-safe version of a file name that keeps its extension. */
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
        (dot > 0 ? name.slice(0, dot) : name)
            .normalize("NFD")
            .replace(COMBINING_MARKS, "")
            .replace(D_STROKE, "d")
            .replace(/[^a-zA-Z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 40) || "file"
    return ext === "" ? stem : `${stem}.${ext}`
}

/** The object path "<workspace_id>/<uuid>-<ascii name>": unique, URL-safe, inside the workspace folder. */
export const buildContentMediaPath = (workspaceId: string, filename: string): string =>
    `${workspaceId}/${crypto.randomUUID()}-${safeName(filename)}`

/** The file name a stored object was uploaded with (the uuid prefix removed). */
export const displayName = (stored: string): string => stored.replace(/^[0-9a-f-]{36}-/i, "")

/** Whether a stored file is a picture or a video the workbench can list. */
export const isListableMedia = (name: string): boolean => /\.(jpe?g|png|webp|mp4|mov|webm)$/i.test(name)

/** Whether a media path is an image. */
export const isImagePath = (path: string | undefined): boolean => /\.(jpe?g|png|webp)$/i.test(path ?? "")
