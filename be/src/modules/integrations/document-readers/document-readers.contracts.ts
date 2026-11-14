import type { Outcome } from "@modules/platform/primitives"

/** The largest file one read takes, in bytes: 50 MB, the largest upload a document may be. */
export const DOCUMENT_MAX_BYTES: number = 50 * 1024 * 1024

/** The most pages (or pictures) of one document sent to the model to be transcribed; later ones are named in a warning. */
export const MAX_TRANSCRIBED_PAGES = 20

/**
 * The most rows of one sheet or delimited file that reach the text (a technical bound, not a quota: 100,000 rows of a 50 MB file; the
 * text is split into parts of 120,000 characters and every part is read whole, in bounded jobs). Rows past it are named in a warning
 * with the exact number left, so nothing is dropped silently.
 */
export const MAX_TABLE_ROWS = 100_000

/** The most pages of a PDF that are read at all. */
export const MAX_PDF_PAGES = 500

/** The kinds of document a reader exists for. */
export type DocumentReaderKind =
    "text" | "markdown" | "csv" | "tsv" | "html" | "pdf" | "docx" | "xlsx" | "pptx" | "image" | "heic"

/** One file to read: its name, the content type the browser or storage gave, and its bytes. */
export interface DocumentFile {
    /** The file name, with its extension when it has one. */
    readonly name: string
    /** The content type; may be empty. */
    readonly mime: string
    /** The bytes. */
    readonly bytes: Uint8Array
}

/** What a place of a document counts: a page of a PDF or a picture, a slide, a sheet of a workbook. */
export type DocumentPlaceKind = "page" | "slide" | "sheet"

/** One stretch of a document at its place, and whether its text was transcribed from a picture. */
export interface DocumentPage {
    /** What the label counts. */
    readonly kind: DocumentPlaceKind
    /** The page or slide number from 1, or the sheet name. */
    readonly label: string
    /** The text of the stretch; empty when nothing could be read there. */
    readonly text: string
    /** True when the text was written by the model from a picture of the page, not read from the file. */
    readonly transcribed: boolean
}

/** One heading of a document and the text under it, as the reader found them. */
export interface DocumentSection {
    /** The heading, or null for the text before the first heading. */
    readonly heading: string | null
    /** The text under it. */
    readonly text: string
}

/** One table of a document: its header and its rows, cell by cell. */
export interface DocumentTable {
    /** The sheet or caption it sits under, or null. */
    readonly name: string | null
    /** The first row. */
    readonly header: ReadonlyArray<string>
    /** The other rows. */
    readonly rows: ReadonlyArray<ReadonlyArray<string>>
}

/** The kinds of note a read leaves about a part it could not read whole. */
export enum DocumentWarningCode {
    /** A page gave no text and could not be transcribed. */
    PageUnreadable = "DOCUMENT_PAGE_UNREADABLE",
    /** A page was transcribed from its picture. */
    PageTranscribed = "DOCUMENT_PAGE_TRANSCRIBED",
    /** Pages past the transcription limit were not read. */
    PagesOverLimit = "DOCUMENT_PAGES_OVER_LIMIT",
    /** Rows past the row limit of a sheet or file were not read. */
    RowsOverLimit = "DOCUMENT_ROWS_OVER_LIMIT",
    /** A sheet or slide holds no text. */
    PlaceEmpty = "DOCUMENT_PLACE_EMPTY",
}

/** One note about a part of a document that was not read whole. */
export interface DocumentWarning {
    /** What happened. */
    readonly code: DocumentWarningCode
    /** The page number, sheet name or slide number it is about, or null for the whole document. */
    readonly place: string | null
    /** A count the note names (the rows read, the pages left), or null. */
    readonly count: number | null
    /** The rows NOT read (rows over the limit), when the note is about rows; absent otherwise. */
    readonly left?: number
}

/** A document as clean, located text for the index job. */
export interface ReadDocument {
    /** The reader that read it. */
    readonly reader: DocumentReaderKind
    /** The whole text: the stretches joined by blank lines. */
    readonly text: string
    /** The stretches with their places; absent when the document names no places (a note, a Word file, a web page). */
    readonly pages?: ReadonlyArray<DocumentPage>
    /** The headings and the text under them, when the document has headings. */
    readonly sections?: ReadonlyArray<DocumentSection>
    /** The tables, when the document has tables. */
    readonly tables?: ReadonlyArray<DocumentTable>
    /** How many pages (PDF, picture) or slides it has; null for a document with none. */
    readonly pageCount: number | null
    /** How many sheets a workbook has; null for any other document. */
    readonly sheetCount: number | null
    /** True when any of its text was transcribed from a picture. */
    readonly transcribed: boolean
    /** The parts it could not read whole. */
    readonly warnings: ReadonlyArray<DocumentWarning>
}

/** Why a document cannot become text. */
export enum DocumentRefusalCode {
    /** No reader exists for this kind of file. */
    TypeUnsupported = "DOCUMENT_TYPE_UNSUPPORTED",
    /** A Word or Excel file of the old binary format (.doc, .xls). */
    LegacyOffice = "DOCUMENT_LEGACY_OFFICE",
    /** The file is larger than a document may be. */
    TooLarge = "DOCUMENT_TOO_LARGE",
    /** The file is damaged, or is not the kind its name says. */
    Unreadable = "DOCUMENT_UNREADABLE",
    /** The file is locked with a password. */
    PasswordProtected = "DOCUMENT_PASSWORD_PROTECTED",
    /** The file was read and holds no text at all. */
    NoText = "DOCUMENT_NO_TEXT",
    /** The library that reads this kind of file is not installed. */
    ReaderUnavailable = "DOCUMENT_READER_UNAVAILABLE",
    /** The file is pictures only and the model that transcribes them cannot be reached. */
    TranscriptionUnavailable = "DOCUMENT_TRANSCRIPTION_UNAVAILABLE",
    /** The file is pictures only and the workspace has no AI allowance left to transcribe them. */
    NoCredits = "DOCUMENT_NO_CREDITS",
}

/** What reading a document gave: its text, or why it cannot be read. */
export type DocumentReadOutcome = Outcome<ReadDocument, DocumentRefusalCode>

/** One picture of a page to transcribe, as JPEG bytes. */
export interface PageImage {
    /** The JPEG bytes. */
    readonly bytes: Uint8Array
    /** Always `image/jpeg`: every picture is turned into one before it is sent. */
    readonly mime: "image/jpeg"
    /** The page number from 1. */
    readonly label: string
}

/** Why a picture could not be transcribed. */
export type TranscriptRefusal = "unavailable" | "no_credits" | "failed"

/** What transcribing a picture gave: the text written on it (empty when nothing is written), or why it failed. */
export type TranscriptOutcome = Outcome<string, TranscriptRefusal>

/**
 * The door to the model that writes down what a picture says, given by the caller for one document (it knows the workspace that pays):
 * one call per picture, "transcribe what is written, do not infer".
 */
export interface Transcriber {
    /** The text of one picture. */
    transcribe(image: PageImage): Promise<TranscriptOutcome>
}

/** The way a document is read: a transcriber for its pictures, or null when pictures must not be sent to the model. */
export interface ReadOptions {
    /** The door for pictures, or null. */
    readonly transcriber: Transcriber | null
}

/** Raw pixels of one picture inside a PDF page, as the PDF library gives them. */
export interface RawImage {
    /** The pixels, row by row. */
    readonly data: Uint8ClampedArray | Uint8Array
    /** Pixels across. */
    readonly width: number
    /** Pixels down. */
    readonly height: number
    /** 1 (grey), 3 (RGB) or 4 (RGBA). */
    readonly channels: number
}

/** What the PDF reader needs of an open PDF. */
export interface PdfDocument {
    /** How many pages it has. */
    readonly pageCount: number
    /** The text of each page, in order. */
    pageTexts(): Promise<ReadonlyArray<string>>
    /** The pictures of one page (from 1). */
    pageImages(page: number): Promise<ReadonlyArray<RawImage>>
    /** The page (from 1) drawn as a PNG, or null when no page painter is installed. */
    renderPage(page: number): Promise<Uint8Array | null>
}

/** The picture operations the readers need. */
export interface PictureTools {
    /** A picture file (JPEG, PNG, WebP, GIF, TIFF, AVIF) turned upright, at most `side` pixels on its long side, as JPEG. Rejects when it is no picture. */
    toJpeg(bytes: Uint8Array, side: number): Promise<Uint8Array>
    /** Raw pixels as JPEG, at most `side` pixels on the long side. */
    rawToJpeg(image: RawImage, side: number): Promise<Uint8Array>
}

/** The libraries behind the readers, each loaded on first use; a loader rejects when its library is not installed. */
export interface DocumentLibraries {
    /** Word to HTML. */
    wordToHtml(bytes: Uint8Array): Promise<string>
    /** Opens a PDF; rejects with an error named `PasswordException` for a locked one. */
    openPdf(bytes: Uint8Array): Promise<PdfDocument>
    /** The picture tools. */
    pictures(): Promise<PictureTools>
    /** HEIC (an iPhone photo) to JPEG; rejects when no HEIC decoder is installed. */
    heicToJpeg(bytes: Uint8Array): Promise<Uint8Array>
}
