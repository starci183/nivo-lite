/** Names and kinds of the entries of a ZIP archive. Pure: no server code and no DOM. */

const MIME: Readonly<Record<string, string>> = {
    txt: "text/plain",
    md: "text/markdown",
    markdown: "text/markdown",
    csv: "text/csv",
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

/** The file types a document may have. */
export const SUPPORTED_FILE = /\.(txt|md|markdown|csv|pdf|docx|xlsx|pptx)$/i

const extOf = (name: string): string => /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? ""

/** MIME from the extension: a File built from zip bytes has no type. An empty text means unsupported. */
export const mimeFromName = (name: string): string => MIME[extOf(name)] ?? ""

/** Whether a name is a ZIP archive. */
export const isArchiveName = (name: string): boolean => extOf(name) === "zip"

/** Directories, macOS resource forks, dotfiles (any path segment) and Thumbs.db are not documents. */
export const isJunkEntry = (path: string): boolean => {
    if (path.endsWith("/") || path.endsWith("\\")) return true
    const parts = path.split(/[\\/]/)
    if (parts[0] === "__MACOSX") return true
    return parts.some((part) => part.startsWith(".")) || /^thumbs\.db$/i.test(parts.at(-1) ?? "")
}

const CP437: ReadonlyArray<number> = [
    0x00c7, 0x00fc, 0x00e9, 0x00e2, 0x00e4, 0x00e0, 0x00e5, 0x00e7, 0x00ea, 0x00eb, 0x00e8, 0x00ef, 0x00ee, 0x00ec,
    0x00c4, 0x00c5, 0x00c9, 0x00e6, 0x00c6, 0x00f4, 0x00f6, 0x00f2, 0x00fb, 0x00f9, 0x00ff, 0x00d6, 0x00dc, 0x00a2,
    0x00a3, 0x00a5, 0x20a7, 0x0192, 0x00e1, 0x00ed, 0x00f3, 0x00fa, 0x00f1, 0x00d1, 0x00aa, 0x00ba, 0x00bf, 0x2310,
    0x00ac, 0x00bd, 0x00bc, 0x00a1, 0x00ab, 0x00bb, 0x2591, 0x2592, 0x2593, 0x2502, 0x2524, 0x2561, 0x2562, 0x2556,
    0x2555, 0x2563, 0x2551, 0x2557, 0x255d, 0x255c, 0x255b, 0x2510, 0x2514, 0x2534, 0x252c, 0x251c, 0x2500, 0x253c,
    0x255e, 0x255f, 0x255a, 0x2554, 0x2569, 0x2566, 0x2560, 0x2550, 0x256c, 0x2567, 0x2568, 0x2564, 0x2565, 0x2559,
    0x2558, 0x2552, 0x2553, 0x256b, 0x256a, 0x2518, 0x250c, 0x2588, 0x2584, 0x258c, 0x2590, 0x2580, 0x03b1, 0x00df,
    0x0393, 0x03c0, 0x03a3, 0x03c3, 0x00b5, 0x03c4, 0x03a6, 0x0398, 0x03a9, 0x03b4, 0x221e, 0x03c6, 0x03b5, 0x2229,
    0x2261, 0x00b1, 0x2265, 0x2264, 0x2320, 0x2321, 0x00f7, 0x2248, 0x00b0, 0x2219, 0x00b7, 0x221a, 0x207f, 0x00b2,
    0x25a0, 0x00a0,
]

/** The raw bytes of a name fflate read as latin1, or null when a character is beyond one byte. */
const rawBytesOf = (name: string): Uint8Array | null => {
    const bytes = new Uint8Array(name.length)
    for (let at = 0; at < name.length; at++) {
        const code = name.codePointAt(at) ?? 0
        if (code > 0xff) return null
        bytes[at] = code
    }
    return bytes
}

/** The bytes as strict UTF-8, or null when they are not. */
const strictUtf8 = (bytes: Uint8Array): string | null => {
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    } catch {
        return null
    }
}

/**
 * fflate decodes names with the UTF-8 flag as UTF-8 and the others as latin1. For the others recover the raw bytes and try strict UTF-8
 * (zips from macOS and Linux tools often omit the flag), then fall back to CP437, the zip default.
 */
export const decodeEntryName = (fflateName: string, utf8Flag: boolean): string => {
    if (utf8Flag) return fflateName
    const bytes = rawBytesOf(fflateName)
    if (bytes === null || bytes.every((byte) => byte < 0x80)) return fflateName
    const decoded = strictUtf8(bytes)
    if (decoded !== null) return decoded
    return Array.from(bytes, (byte) => String.fromCodePoint(byte < 0x80 ? byte : (CP437[byte - 0x80] ?? byte))).join("")
}

/** General-purpose bit flag of every central-directory record, in order; null when the directory cannot be walked (the names then stay as fflate decoded them). */
export const centralFlags = (data: Uint8Array): Array<number> | null => {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let end = data.length - 22
    const stop = Math.max(0, data.length - 22 - 65535)
    while (end >= stop && view.getUint32(end, true) !== 0x06054b50) end--
    if (end < stop) return null
    const count = view.getUint16(end + 10, true)
    let at = view.getUint32(end + 16, true)
    if (count === 0xffff || at === 0xffffffff) return null
    const flags: Array<number> = []
    for (let entry = 0; entry < count; entry++) {
        if (at + 46 > data.length || view.getUint32(at, true) !== 0x02014b50) return null
        flags.push(view.getUint16(at + 8, true))
        at += 46 + view.getUint16(at + 28, true) + view.getUint16(at + 30, true) + view.getUint16(at + 32, true)
    }
    return flags
}

/** "1. STRATEGY" becomes "STRATEGY" (Drive folders are numbered to sort them). */
export const topicFromFolder = (name: string): string =>
    name
        .replace(/^\s*\d+\s*[.)\-\u2013:]\s*/, "")
        .trim()
        .slice(0, 80)
