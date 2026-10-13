import type { MediaFile } from "./content-media.contracts"

/** The private bucket media files live in. */
export const CONTENT_MEDIA_BUCKET = "media"

/** The largest media file, in bytes. */
export const CONTENT_MEDIA_MAX_BYTES = 10 * 1024 * 1024

/** The accepted media types. */
export const CONTENT_MEDIA_MIME: ReadonlyArray<string> = ["image/jpeg", "image/png", "image/webp", "video/mp4"]

/** Whether a file may be uploaded as post media. */
export const isAcceptedMedia = (file: MediaFile): boolean =>
    file.name.trim().length > 0 &&
    file.name.length <= 255 &&
    Number.isInteger(file.sizeBytes) &&
    file.sizeBytes > 0 &&
    file.sizeBytes <= CONTENT_MEDIA_MAX_BYTES &&
    CONTENT_MEDIA_MIME.includes(file.contentType)

const COMBINING_MARKS = new RegExp("[\u0300-\u036f]", "g")
const D_STROKE = new RegExp(String.fromCodePoint(0x111), "gi")
const INVALID_PATH_CHARACTERS = /[%\\\p{Cc}]/u

/** An ASCII, URL-safe file name that keeps its extension. */
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

/** A unique, URL-safe storage path inside the workspace folder. */
export const buildContentMediaPath = (workspaceId: string, filename: string, objectId: string): string =>
    `${workspaceId}/${objectId}-${safeName(filename)}`

/** The displayed file name, with the generated UUID prefix removed. */
export const displayName = (stored: string): string => stored.replace(/^[0-9a-f-]{36}-/i, "")

/** Whether a stored file is a picture or video the workbench can list. */
export const isListableMedia = (name: string): boolean => /\.(jpe?g|png|webp|mp4|mov|webm)$/i.test(name)

/** Whether a path belongs to the workspace without encoded or normalized traversal. */
export const isWorkspaceMediaPath = (workspaceId: string, path: string): boolean =>
    workspaceId !== "" &&
    !workspaceId.includes("/") &&
    path.startsWith(`${workspaceId}/`) &&
    !INVALID_PATH_CHARACTERS.test(path) &&
    path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..")

/** Adds the desired file name to a signed media URL's download request. */
export const withDownloadUrl = (url: string, name: string): string =>
    `${url}${url.includes("?") ? "&" : "?"}download=${encodeURIComponent(name)}`
