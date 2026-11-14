import { attemptAsync, eachInOrder, ok, refused, type OutcomeRefused } from "@modules/platform/primitives"
import {
    DocumentRefusalCode,
    DocumentWarningCode,
    MAX_PDF_PAGES,
    MAX_TRANSCRIBED_PAGES,
    type DocumentLibraries,
    type DocumentPage,
    type DocumentReadOutcome,
    type DocumentWarning,
    type PdfDocument,
    type PictureTools,
    type RawImage,
    type TranscriptRefusal,
    type Transcriber,
} from "./document-readers.contracts"
import { isPdf } from "./document-kind.policy"
import { PICTURE_SIDE, transcribeOne, transcriptRefusal } from "./picture-reader.client"

/** Any letter of any script: a page without one has no text layer worth the name (only page numbers or print marks). */
const LETTER = /\p{L}/u

/** The smallest picture taken for a scanned page: smaller ones are logos and bullets. */
const MIN_SCAN_PIXELS = 160 * 160

/** The PDF of the bytes, or the refusal: a locked PDF is password-protected, any other failure unreadable. */
const opened = async (
    bytes: Uint8Array,
    libraries: DocumentLibraries,
): Promise<PdfDocument | OutcomeRefused<DocumentRefusalCode>> => {
    if (!isPdf(bytes)) return refused(DocumentRefusalCode.Unreadable)
    try {
        return await libraries.openPdf(bytes)
    } catch (cause) {
        const name = cause instanceof Error ? cause.name : ""
        const code = name === "PasswordException" ? DocumentRefusalCode.PasswordProtected : DocumentRefusalCode.Unreadable
        return refused(code, undefined, cause)
    }
}

/** The largest picture of a page, when it is large enough to be the scan of the page. */
const scanOf = (images: ReadonlyArray<RawImage>): RawImage | null => {
    const largest = [...images].sort((left, right) => right.width * right.height - left.width * left.height)[0]
    return largest !== undefined && largest.width * largest.height >= MIN_SCAN_PIXELS ? largest : null
}

/** The state of one reading of a PDF's pages that have no text layer. */
interface ScanState {
    /** Pages sent to the model so far. */
    sent: number
    /** Pages past the limit that were not sent. */
    skipped: number
    /** Why the last failed transcription failed, or null. */
    failure: TranscriptRefusal | null
    /** True when a page had no picture and no painter is installed to draw it. */
    painterMissing: boolean
    /** The notes about the pages. */
    readonly warnings: Array<DocumentWarning>
    /** The failures behind the pages that could not be read, in page order; the refusal of a PDF that gave no text carries the first. */
    readonly causes: Array<unknown>
}

/** The JPEG of a page without a text layer: its scanned picture, else the page painted; null when neither exists. */
const pageJpeg = async (
    pdf: PdfDocument,
    page: number,
    tools: PictureTools,
    state: ScanState,
): Promise<Uint8Array | null> => {
    const images = await attemptAsync(() => pdf.pageImages(page))
    if (!images.ok) state.causes.push(images.cause)
    const scan = images.ok ? scanOf(images.value) : null
    if (scan !== null) return tools.rawToJpeg(scan, PICTURE_SIDE)
    const rendered = await attemptAsync(() => pdf.renderPage(page))
    if (!rendered.ok) state.causes.push(rendered.cause)
    const painted = rendered.ok ? rendered.value : null
    if (painted === null) {
        state.painterMissing = true
        return null
    }
    return tools.toJpeg(painted, PICTURE_SIDE)
}

/** What one scanned page needs besides the document: the picture tools and the transcriber (null when none is connected). */
export interface ScanContext {
    /** The tools that paint a page into a picture. */
    readonly tools: PictureTools
    /** The model that transcribes a picture, or null when none is connected. */
    readonly transcriber: Transcriber | null
}

/** The outcome of one scanned page. */
export interface ScannedPage {
    /** The transcribed text; "" when the page could not be read. */
    readonly text: string
    /** Whether the text came from a transcription. */
    readonly transcribed: boolean
}

/** The text of one page without a text layer, transcribed from its picture; "" when it cannot be (a warning names the page). */
const scannedPage = async (
    pdf: PdfDocument,
    page: number,
    context: ScanContext,
    state: ScanState,
): Promise<ScannedPage> => {
    const label = String(page)
    const unread = (): ScannedPage => {
        state.warnings.push({ code: DocumentWarningCode.PageUnreadable, place: label, count: null })
        return { text: "", transcribed: false }
    }
    if (context.transcriber === null || state.failure === "no_credits") return unread()
    if (state.sent >= MAX_TRANSCRIBED_PAGES) {
        state.skipped += 1
        return { text: "", transcribed: false }
    }
    const made = await attemptAsync(() => pageJpeg(pdf, page, context.tools, state))
    if (!made.ok) state.causes.push(made.cause)
    const jpeg = made.ok ? made.value : null
    if (jpeg === null) return unread()
    state.sent += 1
    const said = await transcribeOne(context.transcriber, { bytes: jpeg, mime: "image/jpeg", label })
    if (said.kind === "failed") {
        state.failure = said.why
        return unread()
    }
    if (said.text === "") return { text: "", transcribed: false }
    state.warnings.push({ code: DocumentWarningCode.PageTranscribed, place: label, count: null })
    return { text: said.text, transcribed: true }
}

/** Why a PDF that gave no text at all is refused. */
const emptyRefusal = (state: ScanState, needed: number, transcriber: Transcriber | null): DocumentRefusalCode => {
    if (needed === 0) return DocumentRefusalCode.NoText
    if (transcriber === null) return DocumentRefusalCode.TranscriptionUnavailable
    if (state.failure !== null) return transcriptRefusal(state.failure)
    return state.painterMissing && state.sent === 0 ? DocumentRefusalCode.ReaderUnavailable : DocumentRefusalCode.NoText
}

/**
 * A PDF page by page. A page with a text layer is read from it; a page without one (a scan, a photographed page) is transcribed from
 * its picture, one model call per page, at most `MAX_TRANSCRIBED_PAGES` pages, and marked transcribed. A page that cannot be read is
 * named in a warning ("trang 3 khong doc duoc"); a locked PDF is refused as password-protected; a PDF that gives no text at all is
 * refused with the reason (no text, no AI allowance, transcription unavailable, or no page painter installed).
 */
export const readPdf = async (
    bytes: Uint8Array,
    libraries: DocumentLibraries,
    transcriber: Transcriber | null,
): Promise<DocumentReadOutcome> => {
    const pdf = await opened(bytes, libraries)
    if ("kind" in pdf) return pdf
    const layers = await attemptAsync(() => pdf.pageTexts())
    if (!layers.ok) return refused(DocumentRefusalCode.Unreadable, undefined, layers.cause)
    const texts = layers.value
    const count = Math.min(pdf.pageCount, MAX_PDF_PAGES)
    const state: ScanState = { sent: 0, skipped: 0, failure: null, painterMissing: false, warnings: [], causes: [] }
    const needing = texts.slice(0, count).filter((text) => !LETTER.test(text)).length
    const tools = needing > 0 && transcriber !== null ? await libraries.pictures() : null
    const pages: Array<DocumentPage> = []
    await eachInOrder(
        Array.from({ length: count }, (_, index) => index + 1),
        async (page) => {
            const layer = texts[page - 1] ?? ""
            if (LETTER.test(layer) || tools === null) {
                if (!LETTER.test(layer))
                    state.warnings.push({ code: DocumentWarningCode.PageUnreadable, place: String(page), count: null })
                pages.push({ kind: "page", label: String(page), text: LETTER.test(layer) ? layer : "", transcribed: false })
                return
            }
            const read = await scannedPage(pdf, page, { tools, transcriber }, state)
            pages.push({ kind: "page", label: String(page), text: read.text, transcribed: read.transcribed })
        },
    )
    const left = state.skipped + Math.max(0, pdf.pageCount - count)
    if (left > 0) state.warnings.push({ code: DocumentWarningCode.PagesOverLimit, place: null, count: left })
    const text = pages
        .map((page) => page.text)
        .filter((one) => one.trim() !== "")
        .join("\n\n")
    if (!LETTER.test(text)) return refused(emptyRefusal(state, needing, transcriber), undefined, state.causes[0])
    return ok({
        reader: "pdf",
        text,
        pages,
        pageCount: pdf.pageCount,
        sheetCount: null,
        transcribed: pages.some((page) => page.transcribed),
        warnings: state.warnings,
    })
}
