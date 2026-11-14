/** The private bucket a kept customer file sits in, in a subfolder of the workspace the media library never lists. */
export const CHAT_FILE_BUCKET = "media"

/** The largest chat file, in bytes. */
export const CHAT_FILE_MAX_BYTES: number = 10 * 1024 * 1024

/** The longest file name kept. */
const NAME_MAX = 255

const PNG_SIGNATURE: ReadonlyArray<number> = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_SIGNATURE: ReadonlyArray<number> = [0xff, 0xd8, 0xff]
const RIFF_SIGNATURE: ReadonlyArray<number> = [0x52, 0x49, 0x46, 0x46]
const WEBP_SIGNATURE: ReadonlyArray<number> = [0x57, 0x45, 0x42, 0x50]
const PDF_SIGNATURE: ReadonlyArray<number> = [0x25, 0x50, 0x44, 0x46, 0x2d]
/** Where the WEBP mark sits after the RIFF header. */
const WEBP_OFFSET = 8

const startsWith = (bytes: Uint8Array, signature: ReadonlyArray<number>, offset = 0): boolean =>
    signature.every((byte, index) => bytes[offset + index] === byte)

/** The accepted type the bytes prove, or null when they are none of them. */
export const sniffChatFile = (bytes: Uint8Array): string | null => {
    if (startsWith(bytes, PNG_SIGNATURE)) return "image/png"
    if (startsWith(bytes, JPEG_SIGNATURE)) return "image/jpeg"
    if (startsWith(bytes, PDF_SIGNATURE)) return "application/pdf"
    return startsWith(bytes, RIFF_SIGNATURE) && startsWith(bytes, WEBP_SIGNATURE, WEBP_OFFSET) ? "image/webp" : null
}

/** The name to keep for a file: its last path part, without control characters, bounded; the path of the object when none is left. */
export const chatFileNameOf = (name: string, path: string): string => {
    const start = Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\")) + 1
    const clean = name
        .slice(start)
        .replaceAll(/\p{Cc}/gu, "")
        .trim()
    return clean === "" ? path.slice(path.lastIndexOf("/") + 1) : clean.slice(-NAME_MAX)
}
