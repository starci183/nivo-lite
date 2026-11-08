/** The private bucket the files of the chat sit in, under the workspace and the room. */
export const TEAM_CHAT_FILE_BUCKET: string = "media"

/** The largest file of a message, in bytes: 25 MB. */
export const TEAM_CHAT_FILE_MAX_BYTES: number = 25 * 1024 * 1024

/** How long a signed address to read or write a file lasts, in seconds. */
export const TEAM_CHAT_FILE_URL_SECONDS: number = 15 * 60

/** The types a message may carry, each with the extension it is stored under. */
const EXTENSION_OF: Readonly<Record<string, string>> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
    "text/plain": "txt",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
}

/** The longest file name kept. */
const NAME_MAX = 120

/** The text of the shape of an id, as one part of a key pattern. */
const UUID: string = String.raw`[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}`

/** Whether the type is one a message may carry. */
export const isAcceptedType = (mimeType: string): boolean => EXTENSION_OF[mimeType] !== undefined

/** The type a stored extension stands for; null for an extension no message carries. */
export const typeOfExtension = (extension: string): string | null =>
    Object.entries(EXTENSION_OF).find(([, stored]) => stored === extension)?.[0] ?? null

/** A file name as it is kept in the path: no folder parts, no control or unsafe characters, bounded, with the extension of its type. */
export const fileNameOf = (name: string, mimeType: string): string => {
    const extension = EXTENSION_OF[mimeType] ?? "bin"
    const bare = name
        .replace(/^.*[\\/]/u, "")
        .replace(/\.[^.]*$/u, "")
        .replaceAll(/[^\p{L}\p{N}._ -]+/gu, "_")
        .trim()
        .slice(0, NAME_MAX)
    return `${bare === "" ? "file" : bare}.${extension}`
}

/** The path of an uploaded file: workspace, room, a fresh id, then the name, so the name travels with the key. */
export const filePathOf = (workspaceId: string, roomId: string, id: string, name: string): string =>
    `${workspaceId}/team-chat/${roomId}/${id}/${name}`

const PATH = (workspaceId: string, roomId: string): RegExp =>
    new RegExp(`^${workspaceId}/team-chat/${roomId}/${UUID}/([^/]{1,${String(NAME_MAX + 8)}})$`, "iu")

/** The file name inside a key of this room of this workspace, or null when the key is not one of them. */
export const nameInPath = (workspaceId: string, roomId: string, path: string): string | null =>
    PATH(workspaceId, roomId).exec(path)?.[1] ?? null

/** The extension of a stored name, lower case. */
export const extensionOf = (name: string): string => name.slice(name.lastIndexOf(".") + 1).toLowerCase()
