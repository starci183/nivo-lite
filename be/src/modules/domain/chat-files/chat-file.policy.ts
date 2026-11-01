import type { ChatFileFacts, ChatFileScope, ChatFileView } from "./chat-files.contracts"

/** The private bucket: a chat file sits in a subfolder of the workspace, which the media library never lists. */
export const CHAT_FILE_BUCKET = "media"

/** The largest chat file, in bytes. */
export const CHAT_FILE_MAX_BYTES = 10 * 1024 * 1024

/** The longest file name kept. */
const NAME_MAX = 255

/** The accepted types and the extension each is stored under: what a turn can read, as a picture or as text. */
const EXTENSION_OF: Readonly<Record<string, string>> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
}

const PNG_SIGNATURE: ReadonlyArray<number> = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_SIGNATURE: ReadonlyArray<number> = [0xff, 0xd8, 0xff]
const RIFF_SIGNATURE: ReadonlyArray<number> = [0x52, 0x49, 0x46, 0x46]
const WEBP_SIGNATURE: ReadonlyArray<number> = [0x57, 0x45, 0x42, 0x50]
const PDF_SIGNATURE: ReadonlyArray<number> = [0x25, 0x50, 0x44, 0x46, 0x2d]
/** Where the WEBP mark sits after the RIFF header. */
const WEBP_OFFSET = 8

const FILE_NAME = /^[0-9a-f-]{36}\.(?:jpg|png|webp|pdf)$/u

const startsWith = (bytes: Uint8Array, signature: ReadonlyArray<number>, offset = 0): boolean =>
    signature.every((byte, index) => bytes[offset + index] === byte)

/** Whether the declared facts are worth an upload address; the bytes decide at send. */
export const isAcceptedChatFile = (file: ChatFileFacts): boolean =>
    Number.isInteger(file.sizeBytes) &&
    file.sizeBytes > 0 &&
    file.sizeBytes <= CHAT_FILE_MAX_BYTES &&
    EXTENSION_OF[file.contentType] !== undefined

/** The folder of the files of the Office, which is no conversation. */
const OFFICE_FOLDER = "office"

const folderOf = (scope: ChatFileScope): string => `${scope.workspaceId}/chat/${scope.conversationId ?? OFFICE_FOLDER}`

/** The object path of a new file, inside the folder of its workspace and conversation. */
export const chatFilePathOf = (scope: ChatFileScope, objectId: string, contentType: string): string =>
    `${folderOf(scope)}/${objectId}.${EXTENSION_OF[contentType] ?? ""}`

/** Whether a path a browser hands back is a file of this conversation: nothing else may be attached to it. */
export const isChatFilePath = (scope: ChatFileScope, path: string): boolean => {
    const folder = `${folderOf(scope)}/`
    return path.startsWith(folder) && FILE_NAME.test(path.slice(folder.length))
}

/** The accepted type the bytes prove, or null when they are none of them. */
export const sniffChatFile = (bytes: Uint8Array): string | null => {
    if (startsWith(bytes, PNG_SIGNATURE)) return "image/png"
    if (startsWith(bytes, JPEG_SIGNATURE)) return "image/jpeg"
    if (startsWith(bytes, PDF_SIGNATURE)) return "application/pdf"
    return startsWith(bytes, RIFF_SIGNATURE) && startsWith(bytes, WEBP_SIGNATURE, WEBP_OFFSET) ? "image/webp" : null
}

/** The files of one message among those of a thread. */
export const filesOfMessage = (files: ReadonlyArray<ChatFileView>, messageId: string): ReadonlyArray<ChatFileView> =>
    files.filter((file) => file.messageId === messageId)

/** The name to keep for a file: its last path part, without control characters, bounded; the path of the object when none is left. */
export const chatFileNameOf = (name: string, path: string): string => {
    const clean = (name.split(/[/\\]/u).pop() ?? "").replace(/\p{Cc}/gu, "").trim()
    return clean === "" ? (path.split("/").pop() ?? path) : clean.slice(-NAME_MAX)
}
