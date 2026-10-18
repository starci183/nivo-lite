/** The kinds of file whose text can be read. */
export type TextKind = "text" | "pdf" | "docx" | "xlsx" | "pptx"

/** What asking for the kind of a file yields: a kind, or null when it cannot be read. */
export type TextKindResult = TextKind | null

const BY_EXTENSION: ReadonlyMap<string, TextKind> = new Map<string, TextKind>([
    ["pdf", "pdf"],
    ["docx", "docx"],
    ["xlsx", "xlsx"],
    ["pptx", "pptx"],
    ["txt", "text"],
    ["md", "text"],
    ["markdown", "text"],
    ["csv", "text"],
])

/** The kind of a file by its name; null when the extension is not one that can be read, or there is none. */
export const fileTextKind = (name: string): TextKindResult => {
    const dot = name.lastIndexOf(".")
    return dot < 0 ? null : (BY_EXTENSION.get(name.slice(dot + 1).toLowerCase()) ?? null)
}

/** True when the name carries an extension (the file is then refused or accepted by it, never sniffed). */
export const hasExtension = (name: string): boolean => /\.[a-z0-9]+$/iu.test(name)

/** The kind of a downloaded body: magic bytes first, then the content type. null = not a type that can be read. */
export const sniffTextKind = (bytes: Uint8Array, contentType: string): TextKindResult => {
    if (new TextDecoder("latin1").decode(bytes.subarray(0, 5)) === "%PDF-") return "pdf"
    if (/wordprocessingml/iu.test(contentType)) return "docx"
    if (/spreadsheetml/iu.test(contentType)) return "xlsx"
    if (/presentationml/iu.test(contentType)) return "pptx"
    if (/(?:^text\/(?!html))|(?:csv|json|markdown|xml)/iu.test(contentType)) return "text"
    return null
}
