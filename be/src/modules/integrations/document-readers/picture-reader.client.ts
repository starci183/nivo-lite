import { ok, refused } from "@modules/platform/primitives"
import { DocumentRefusalCode, DocumentWarningCode, LibraryMissingError } from "./document-readers.contracts"
import type {
    DocumentLibraries,
    DocumentReadOutcome,
    DocumentReaderKind,
    PageImage,
    TranscriptRefusal,
    Transcriber,
} from "./document-readers.contracts"

/** The long side a picture is sent at: enough for hand-writing, small enough to stay cheap. */
export const PICTURE_SIDE = 2000

/** What transcribing one picture gave: its text (maybe empty), or why it failed. */
export type PictureTranscript =
    { readonly kind: "text"; readonly text: string } | { readonly kind: "failed"; readonly why: TranscriptRefusal }

/** One picture through the transcriber: the text written on it, trimmed, or why it failed. */
export const transcribeOne = async (transcriber: Transcriber, image: PageImage): Promise<PictureTranscript> => {
    const said = await transcriber.transcribe(image)
    return said.kind === "ok" ? { kind: "text", text: said.value.trim() } : { kind: "failed", why: said.code }
}

/** The refusal of a document whose only text had to come from pictures and none came. */
export const transcriptRefusal = (why: TranscriptRefusal | null): DocumentRefusalCode => {
    if (why === "no_credits") return DocumentRefusalCode.NoCredits
    return why === null ? DocumentRefusalCode.NoText : DocumentRefusalCode.TranscriptionUnavailable
}

/** The JPEG of a photo, HEIC decoded first; a refusal code when it cannot be decoded. */
const jpegOf = async (
    kind: DocumentReaderKind,
    bytes: Uint8Array,
    libraries: DocumentLibraries,
): Promise<Uint8Array | DocumentRefusalCode> => {
    try {
        const decoded = kind === "heic" ? await libraries.heicToJpeg(bytes) : bytes
        return await (await libraries.pictures()).toJpeg(decoded, PICTURE_SIDE)
    } catch (cause) {
        return cause instanceof LibraryMissingError
            ? DocumentRefusalCode.ReaderUnavailable
            : DocumentRefusalCode.Unreadable
    }
}

/**
 * A photo (a hand-written price list, a menu on the wall) as text: it is turned upright, scaled and sent as ONE transcription call,
 * "transcribe what is written, do not infer". The text is marked transcribed. A photo with nothing written on it is refused as no text,
 * a photo with no transcriber (or none that answers) as transcription unavailable.
 */
export const readPicture = async (
    kind: DocumentReaderKind,
    bytes: Uint8Array,
    libraries: DocumentLibraries,
    transcriber: Transcriber | null,
): Promise<DocumentReadOutcome> => {
    const jpeg = await jpegOf(kind, bytes, libraries)
    if (!(jpeg instanceof Uint8Array)) return refused(jpeg)
    if (transcriber === null) return refused(DocumentRefusalCode.TranscriptionUnavailable)
    const said = await transcribeOne(transcriber, { bytes: jpeg, mime: "image/jpeg", label: "1" })
    if (said.kind === "failed") return refused(transcriptRefusal(said.why))
    if (said.text === "") return refused(DocumentRefusalCode.NoText)
    return ok({
        reader: kind,
        text: said.text,
        pages: [{ kind: "page", label: "1", text: said.text, transcribed: true }],
        pageCount: 1,
        sheetCount: null,
        transcribed: true,
        warnings: [{ code: DocumentWarningCode.PageTranscribed, place: "1", count: null }],
    })
}
