import { DocumentRefusalCode } from "./document-readers.contracts"
import type { DocumentReaderKind } from "./document-readers.contracts"

/** The kind of a file, or why no reader takes it. */
export type KindVerdict =
    | { readonly kind: "reader"; readonly reader: DocumentReaderKind }
    | { readonly kind: "refused"; readonly code: DocumentRefusalCode }

/** The reader of each extension a document can be read from. */
const BY_EXTENSION: ReadonlyMap<string, DocumentReaderKind> = new Map<string, DocumentReaderKind>([
    ["txt", "text"],
    ["text", "text"],
    ["md", "markdown"],
    ["markdown", "markdown"],
    ["csv", "csv"],
    ["tsv", "tsv"],
    ["tab", "tsv"],
    ["html", "html"],
    ["htm", "html"],
    ["pdf", "pdf"],
    ["docx", "docx"],
    ["xlsx", "xlsx"],
    ["pptx", "pptx"],
    ["jpg", "image"],
    ["jpeg", "image"],
    ["png", "image"],
    ["webp", "image"],
    ["gif", "image"],
    ["tif", "image"],
    ["tiff", "image"],
    ["avif", "image"],
    ["heic", "heic"],
    ["heif", "heic"],
])

/** Old binary Office formats: a person can save them again in the new format. */
const LEGACY_OFFICE: ReadonlySet<string> = new Set(["doc", "xls", "ppt"])

/** The extension of a file name, lower case, or "" when it has none. */
export const extensionOf = (name: string): string => {
    const match = /\.([a-z0-9]+)$/iu.exec(name.trim())
    return match?.[1]?.toLowerCase() ?? ""
}

/** True when the bytes start with the given signature. */
const startsWith = (bytes: Uint8Array, signature: ReadonlyArray<number>): boolean =>
    signature.every((byte, index) => bytes[index] === byte)

/** The first bytes of a zip archive, which every new Office file starts with. */
export const isZip = (bytes: Uint8Array): boolean => startsWith(bytes, [0x50, 0x4b])

/** The first bytes of a PDF. */
export const isPdf = (bytes: Uint8Array): boolean => startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])

/** The first bytes of an OLE compound file: an old Office file, or a new one locked with a password. */
export const isCompoundFile = (bytes: Uint8Array): boolean =>
    startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])

/** The name `EncryptedPackage` in UTF-16, which a password-locked Office file carries as a stream name. */
const ENCRYPTED_PACKAGE = new Uint8Array([...Buffer.from("EncryptedPackage", "utf16le")])

/** True when a compound file is a new Office file locked with a password (it holds an `EncryptedPackage` stream). */
export const isLockedOffice = (bytes: Uint8Array): boolean =>
    isCompoundFile(bytes) && Buffer.from(bytes).includes(Buffer.from(ENCRYPTED_PACKAGE))

/** The reader of a picture or PDF by its first bytes, or null. */
const sniffed = (bytes: Uint8Array): DocumentReaderKind | null => {
    if (isPdf(bytes)) return "pdf"
    if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image"
    if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "image"
    if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "image"
    const head = Buffer.from(bytes.subarray(0, 12)).toString("latin1")
    if (head.startsWith("RIFF") && head.slice(8, 12) === "WEBP") return "image"
    return null
}

/** The reader of a content type, or null. */
const byMime = (mime: string): DocumentReaderKind | null => {
    const type = mime.split(";", 1).join("").trim().toLowerCase()
    if (type === "") return null
    if (type === "image/heic" || type === "image/heif") return "heic"
    if (type.startsWith("image/")) return "image"
    if (type === "application/pdf") return "pdf"
    if (type.includes("wordprocessingml")) return "docx"
    if (type.includes("spreadsheetml")) return "xlsx"
    if (type.includes("presentationml")) return "pptx"
    if (type === "text/csv") return "csv"
    if (type === "text/tab-separated-values") return "tsv"
    if (type === "text/html") return "html"
    if (type === "text/markdown") return "markdown"
    return type.startsWith("text/") ? "text" : null
}

/** True when a file name can be taken at the upload door: a known extension, or none (the kind is then found from the bytes). */
export const acceptsName = (name: string): boolean => {
    const extension = extensionOf(name)
    return extension === "" || BY_EXTENSION.has(extension) || LEGACY_OFFICE.has(extension)
}

/**
 * The reader of a file: its extension decides, and an unknown extension is refused; a file without one is known by its first bytes,
 * then its content type. An old binary
 * Office file is refused with its own code (it can be saved again as a new one), and any other unknown file as unsupported.
 */
export const kindOf = (name: string, mime: string, bytes: Uint8Array): KindVerdict => {
    const extension = extensionOf(name)
    if (LEGACY_OFFICE.has(extension)) return { kind: "refused", code: DocumentRefusalCode.LegacyOffice }
    const reader = extension === "" ? (sniffed(bytes) ?? byMime(mime)) : (BY_EXTENSION.get(extension) ?? null)
    if (reader !== null) return { kind: "reader", reader }
    return { kind: "refused", code: DocumentRefusalCode.TypeUnsupported }
}
