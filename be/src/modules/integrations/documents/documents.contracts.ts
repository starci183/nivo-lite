/** The most characters of text one document yields; a longer text is cut here. */
export const DOCUMENT_TEXT_MAX_CHARS = 120_000

/** The largest body a link is allowed to download, in bytes. */
export const LINK_MAX_BYTES = 12_000_000

/** The largest file read from Google Drive, in bytes. */
export const DRIVE_MAX_BYTES = 10_000_000

/** Where the Google Drive access of a workspace stands. */
export type DocumentGrantState = "none" | "connected" | "lost"

/** What runs with a valid Drive access token. */
export type DriveTokenUse<T> = (token: string) => Promise<T>

/** The Drive id of a folder, or null when an address names none. */
export type MaybeFolderId = string | null

/** The Drive access of a workspace, or null when the caller has none (an API key). */
export type MaybeDriveAccess = DriveAccess | null

/**
 * How the Google Drive access of one workspace is reached; the knowledge domain implements it over its stored grant.
 */
export interface DriveAccess {
    /** Whether the workspace has given access, never did, or lost it. */
    state(): Promise<DocumentGrantState>
    /**
     * Runs `use` with a valid access token; the implementation refreshes the token, and retries once when Drive answers
     * 401.
     */
    withToken<T>(use: DriveTokenUse<T>): Promise<T>
}

/** The text of a link and the title the page or file gave itself. */
export interface DocumentText {
    /** The text, at most DOCUMENT_TEXT_MAX_CHARS characters. */
    readonly text: string
    /** The title of the page or file, when it has one. */
    readonly title: string | null
}

/** The text of one Drive file with the name it has in Drive. */
export interface DriveFileText {
    /** The name of the file in Drive. */
    readonly name: string
    /** The text, at most DOCUMENT_TEXT_MAX_CHARS characters. */
    readonly text: string
}

/** One file found in a Drive folder. */
export interface DriveFile {
    /** The Drive id. */
    readonly id: string
    /** The name in Drive. */
    readonly name: string
    /** The Drive type. */
    readonly mimeType: string
    /** The size in bytes, when Drive reports it. */
    readonly size: number | null
    /** The last change, when Drive reports it. */
    readonly modifiedTime: string | null
    /** The folders between the pasted folder and the file, joined by "/"; empty at the top. */
    readonly path: string
}

/** The files of a Drive folder and whether the listing was cut at the limits. */
export interface DriveFolderListing {
    /** The name of the pasted folder. */
    readonly name: string
    /** The files below it, folders themselves left out. */
    readonly files: ReadonlyArray<DriveFile>
    /** True when the listing stopped at the file or depth limit. */
    readonly truncated: boolean
}

/** The answer of Google's token endpoint to a refresh. */
export interface GoogleAccessToken {
    /** The new access token. */
    readonly accessToken: string
    /** A new refresh token, when Google rotated it. */
    readonly refreshToken: string | null
    /** How long the access token lives, in seconds. */
    readonly expiresInSeconds: number
}

/** The two readers that need a library the unit specs cannot load; the composition root provides the real ones. */
export interface DocumentReaders {
    /** The text of a Word file. */
    docx(bytes: Uint8Array): Promise<string>
    /** The text of a PDF, pages merged. */
    pdf(bytes: Uint8Array): Promise<string>
}

/** The merged PDF text and the original document page count. */
export interface DocumentFileTextResult {
    /** The merged text of all pages. */
    readonly text: string
    /** The number of pages in the source PDF. */
    readonly pages: number
}

/** The document SDKs, each loaded on first use. */
export interface DocumentLibrarySdks {
    /** The Word text extractor. */
    readonly mammoth: () => Promise<Pick<typeof import("mammoth"), "extractRawText">>
    /** The PDF text extractor. */
    readonly unpdf: () => Promise<Pick<typeof import("unpdf"), "extractText" | "getDocumentProxy">>
}

/** Library extraction results needed by uploaded-file consumers. */
export interface DocumentFileReaders extends DocumentReaders {
    /** Merged PDF text together with the original page count. */
    pdfDetails(bytes: Uint8Array): Promise<DocumentFileTextResult>
}
