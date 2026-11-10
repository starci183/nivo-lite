import type { LocatedText } from "@modules/domain/knowledge-chunks"
import { StoredNote } from "@modules/domain/knowledge-sources"
import type { ReadingWarning, SourceReading } from "@modules/domain/knowledge-sources"
import { DocumentRefusalCode, DocumentWarningCode } from "@modules/integrations/document-readers"
import type { DocumentWarning, ReadDocument } from "@modules/integrations/document-readers"
import { DocumentsErrorCode } from "@modules/integrations/documents"

/** The stored note (the code the Knowledge list shows its own text for) of each refusal of the readers. */
const NOTE_OF_REFUSAL: Readonly<Record<DocumentRefusalCode, string>> = {
    [DocumentRefusalCode.TypeUnsupported]: DocumentsErrorCode.TypeUnsupported,
    [DocumentRefusalCode.LegacyOffice]: StoredNote.LegacyOffice,
    [DocumentRefusalCode.TooLarge]: StoredNote.FileTooLarge,
    [DocumentRefusalCode.Unreadable]: StoredNote.Unreadable,
    [DocumentRefusalCode.PasswordProtected]: StoredNote.PasswordProtected,
    [DocumentRefusalCode.NoText]: StoredNote.Empty,
    [DocumentRefusalCode.ReaderUnavailable]: StoredNote.ReaderUnavailable,
    [DocumentRefusalCode.TranscriptionUnavailable]: StoredNote.TranscriptionUnavailable,
    [DocumentRefusalCode.NoCredits]: StoredNote.NoCreditsForTranscription,
}

/** The catalog key of the plain reason of each refusal. */
const REASON_KEYS: Readonly<Record<DocumentRefusalCode, string>> = {
    [DocumentRefusalCode.TypeUnsupported]: "reading.refusal.DOCUMENT_TYPE_UNSUPPORTED",
    [DocumentRefusalCode.LegacyOffice]: "reading.refusal.DOCUMENT_LEGACY_OFFICE",
    [DocumentRefusalCode.TooLarge]: "reading.refusal.DOCUMENT_TOO_LARGE",
    [DocumentRefusalCode.Unreadable]: "reading.refusal.DOCUMENT_UNREADABLE",
    [DocumentRefusalCode.PasswordProtected]: "reading.refusal.DOCUMENT_PASSWORD_PROTECTED",
    [DocumentRefusalCode.NoText]: "reading.refusal.DOCUMENT_NO_TEXT",
    [DocumentRefusalCode.ReaderUnavailable]: "reading.refusal.DOCUMENT_READER_UNAVAILABLE",
    [DocumentRefusalCode.TranscriptionUnavailable]: "reading.refusal.DOCUMENT_TRANSCRIPTION_UNAVAILABLE",
    [DocumentRefusalCode.NoCredits]: "reading.refusal.DOCUMENT_NO_CREDITS",
}

/** The catalog key of each warning. */
const WARNING_KEYS: Readonly<Record<DocumentWarningCode, string>> = {
    [DocumentWarningCode.PageUnreadable]: "reading.warning.DOCUMENT_PAGE_UNREADABLE",
    [DocumentWarningCode.PageTranscribed]: "reading.warning.DOCUMENT_PAGE_TRANSCRIBED",
    [DocumentWarningCode.PagesOverLimit]: "reading.warning.DOCUMENT_PAGES_OVER_LIMIT",
    [DocumentWarningCode.RowsOverLimit]: "reading.warning.DOCUMENT_ROWS_OVER_LIMIT",
    [DocumentWarningCode.PlaceEmpty]: "reading.warning.DOCUMENT_PLACE_EMPTY",
}

/** The most warnings a reading keeps: a 500-page scan names its first pages, and the stored reading stays small. */
const MAX_WARNINGS = 60

/** Renders one catalog key in Vietnamese with its parameters. */
export type Say = (key: string, params: Readonly<Record<string, string | number>>) => string

/** The stored note of a refusal. */
export const noteOfRefusal = (code: DocumentRefusalCode): string => NOTE_OF_REFUSAL[code]

/** The warnings of a reading in plain Vietnamese, at most `MAX_WARNINGS`. */
const warningsOf = (warnings: ReadonlyArray<DocumentWarning>, say: Say): Array<ReadingWarning> =>
    warnings.slice(0, MAX_WARNINGS).map((warning) => ({
        code: warning.code,
        place: warning.place,
        count: warning.count,
        message: say(WARNING_KEYS[warning.code], { place: warning.place ?? "", count: warning.count ?? 0 }),
    }))

/** Where and when a document was read: the stored object and the instant. */
export interface ReadingStamp {
    /** The stored object read, or null. */
    readonly path: string | null
    /** When. */
    readonly at: Date
}

/** The reading of a document the readers read. */
export const readingOfDocument = (read: ReadDocument, say: Say, stamp: ReadingStamp): SourceReading => ({
    reader: read.reader,
    pageCount: read.pageCount,
    sheetCount: read.sheetCount,
    transcribed: read.transcribed,
    warnings: warningsOf(read.warnings, say),
    refusal: null,
    reason: null,
    readAt: stamp.at.toISOString(),
    path: stamp.path,
})

/** The reading of a document the readers refused: the stored note and the plain reason. */
export const readingOfRefusal = (code: DocumentRefusalCode, say: Say, stamp: ReadingStamp): SourceReading => ({
    reader: "file",
    pageCount: null,
    sheetCount: null,
    transcribed: false,
    warnings: [],
    refusal: noteOfRefusal(code),
    reason: say(REASON_KEYS[code], {}),
    readAt: stamp.at.toISOString(),
    path: stamp.path,
})

/** The stretches of a document with their places, for the chunker; undefined when it names no places. */
export const partsOfDocument = (read: ReadDocument): ReadonlyArray<LocatedText> | undefined =>
    read.pages?.map((page) => ({ place: { kind: page.kind, label: page.label }, text: page.text }))
