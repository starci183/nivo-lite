import { ok, refused } from "@modules/platform/primitives"
import { DocumentRefusalCode, DocumentWarningCode, MAX_TRANSCRIBED_PAGES } from "./document-readers.contracts"
import type {
    DocumentLibraries,
    PageImage,
    PdfDocument,
    PictureTools,
    RawImage,
    TranscriptOutcome,
    Transcriber,
} from "./document-readers.contracts"
import { DocumentReadersError, DocumentReadersErrorCode } from "./errors/document-readers.error"
import { readPdf } from "./pdf-reader.client"

/** The first bytes of a PDF: the reader checks them before it opens anything. */
const PDF = new TextEncoder().encode("%PDF-1.7\n%tiny fixture\n")

/** A scanned page: one full-page picture. */
const SCAN: RawImage = { data: new Uint8Array(400 * 300 * 3), width: 400, height: 300, channels: 3 }

/** A logo too small to be a page scan. */
const LOGO: RawImage = { data: new Uint8Array(20 * 20 * 3), width: 20, height: 20, channels: 3 }

/** A PDF scripted page by page: the text layer of each page, its pictures, and whether a painter is installed. */
const pdfOf = (
    texts: ReadonlyArray<string>,
    images: (page: number) => ReadonlyArray<RawImage> = () => [],
    painted: Uint8Array | null = null,
): PdfDocument => ({
    pageCount: texts.length,
    pageTexts: () => Promise.resolve(texts),
    pageImages: (page) => Promise.resolve(images(page)),
    renderPage: () => Promise.resolve(painted),
})

/** Picture tools that answer a fixed JPEG and count their calls. */
const tools = () => {
    const calls = { raw: 0, file: 0 }
    const pictures: PictureTools = {
        toJpeg: () => {
            calls.file += 1
            return Promise.resolve(new Uint8Array([0xff, 0xd8, 2]))
        },
        rawToJpeg: () => {
            calls.raw += 1
            return Promise.resolve(new Uint8Array([0xff, 0xd8, 1]))
        },
    }
    return { pictures, calls }
}

const librariesOf = (pdf: PdfDocument | Error, pictures: PictureTools = tools().pictures): DocumentLibraries => ({
    wordToHtml: () => Promise.reject(new DocumentReadersError({ code: DocumentReadersErrorCode.LibraryMissing, params: { library: "unused" } })),
    openPdf: () => (pdf instanceof Error ? Promise.reject(pdf) : Promise.resolve(pdf)),
    pictures: () => Promise.resolve(pictures),
    heicToJpeg: () => Promise.reject(new DocumentReadersError({ code: DocumentReadersErrorCode.LibraryMissing, params: { library: "unused" } })),
})

/** A transcriber scripted by page label; it keeps the pages it was sent. */
const scripted = (answer: (label: string) => TranscriptOutcome) => {
    const sent: Array<PageImage> = []
    const transcriber: Transcriber = {
        transcribe: (image) => {
            sent.push(image)
            return Promise.resolve(answer(image.label))
        },
    }
    return { transcriber, sent }
}

describe("pdf reader", () => {
    it("reads a PDF with a text layer page by page and never calls the model", async () => {
        const { transcriber, sent } = scripted(() => ok("never"))
        const read = await readPdf(PDF, librariesOf(pdfOf(["B\u1EA3ng gi\u00E1 th\u00E1ng 11", "H\u1ED3ng \u0111\u1ECF 35.000"])), transcriber)
        expect(read).toEqual({
            kind: "ok",
            value: {
                reader: "pdf",
                text: "B\u1EA3ng gi\u00E1 th\u00E1ng 11\n\nH\u1ED3ng \u0111\u1ECF 35.000",
                pages: [
                    { kind: "page", label: "1", text: "B\u1EA3ng gi\u00E1 th\u00E1ng 11", transcribed: false },
                    { kind: "page", label: "2", text: "H\u1ED3ng \u0111\u1ECF 35.000", transcribed: false },
                ],
                pageCount: 2,
                sheetCount: null,
                transcribed: false,
                warnings: [],
            },
        })
        expect(sent).toHaveLength(0)
    })

    it("transcribes a scanned page from its largest picture, one call per page, and names a page it could not read", async () => {
        const { pictures, calls } = tools()
        const pdf = pdfOf(["Trang ch\u1EEF", "", " 3 "], (page) => (page === 2 ? [LOGO, SCAN] : [SCAN]))
        const { transcriber, sent } = scripted((label) =>
            label === "2" ? ok("Hoa c\u01B0\u1EDBi | 1.200.000") : refused("failed"),
        )
        const read = await readPdf(PDF, librariesOf(pdf, pictures), transcriber)
        expect(read).toMatchObject({
            kind: "ok",
            value: {
                text: "Trang ch\u1EEF\n\nHoa c\u01B0\u1EDBi | 1.200.000",
                transcribed: true,
                warnings: [
                    { code: DocumentWarningCode.PageTranscribed, place: "2", count: null },
                    { code: DocumentWarningCode.PageUnreadable, place: "3", count: null },
                ],
            },
        })
        expect(sent.map((image) => image.label)).toEqual(["2", "3"])
        expect(calls.raw).toBe(2)
    })

    it("paints a page with no text and no picture when a painter is installed, and says so when none is", async () => {
        const painted = tools()
        const { transcriber } = scripted(() => ok("V\u1EBD tay: hoa ly 50k"))
        const withPainter = await readPdf(
            PDF,
            librariesOf(
                pdfOf([""], () => [], new Uint8Array([1])),
                painted.pictures,
            ),
            transcriber,
        )
        expect(withPainter).toMatchObject({ kind: "ok", value: { text: "V\u1EBD tay: hoa ly 50k", transcribed: true } })
        expect(painted.calls.file).toBe(1)
        const without = await readPdf(PDF, librariesOf(pdfOf([""], () => [LOGO], null)), transcriber)
        expect(without).toMatchObject({ code: DocumentRefusalCode.ReaderUnavailable })
    })

    it("stops sending pages at the transcription limit and counts the pages left", async () => {
        const count = MAX_TRANSCRIBED_PAGES + 2
        const { transcriber, sent } = scripted((label) => ok(`Trang ${label}`))
        const read = await readPdf(
            PDF,
            librariesOf(
                pdfOf(
                    Array.from({ length: count }, () => ""),
                    () => [SCAN],
                ),
            ),
            transcriber,
        )
        expect(sent).toHaveLength(MAX_TRANSCRIBED_PAGES)
        expect(read.kind === "ok" ? read.value.warnings.at(-1) : null).toEqual({
            code: DocumentWarningCode.PagesOverLimit,
            place: null,
            count: 2,
        })
    })

    it("stops transcribing once the allowance is used up, and refuses a scan that gave nothing with the reason", async () => {
        const { transcriber, sent } = scripted(() => refused("no_credits"))
        const read = await readPdf(PDF, librariesOf(pdfOf(["", ""], () => [SCAN])), transcriber)
        expect(read).toMatchObject({ code: DocumentRefusalCode.NoCredits })
        expect(sent).toHaveLength(1)
        await expect(readPdf(PDF, librariesOf(pdfOf([""], () => [SCAN])), null)).resolves.toMatchObject({
            code: DocumentRefusalCode.TranscriptionUnavailable,
        })
        await expect(
            readPdf(PDF, librariesOf(pdfOf([""], () => [SCAN])), scripted(() => ok("")).transcriber),
        ).resolves.toMatchObject({ code: DocumentRefusalCode.NoText })
    })

    it("names every scanned page unreadable when there is no transcriber but other pages have text", async () => {
        const read = await readPdf(PDF, librariesOf(pdfOf(["C\u00F3 ch\u1EEF", ""])), null)
        expect(read).toMatchObject({
            kind: "ok",
            value: {
                text: "C\u00F3 ch\u1EEF",
                warnings: [{ code: DocumentWarningCode.PageUnreadable, place: "2", count: null }],
            },
        })
    })

    it("refuses a locked PDF as password-protected, a damaged one and a body that is no PDF as unreadable", async () => {
        const locked = Object.assign(new Error("No password given"), { name: "PasswordException" })
        await expect(readPdf(PDF, librariesOf(locked), null)).resolves.toMatchObject({
            code: DocumentRefusalCode.PasswordProtected,
        })
        await expect(readPdf(PDF, librariesOf(new Error("Invalid PDF structure")), null)).resolves.toMatchObject({
            code: DocumentRefusalCode.Unreadable,
        })
        await expect(readPdf(new Uint8Array([1, 2]), librariesOf(pdfOf(["x"])), null)).resolves.toMatchObject({
            code: DocumentRefusalCode.Unreadable,
        })
        const broken: PdfDocument = { ...pdfOf(["x"]), pageTexts: () => Promise.reject(new Error("bad stream")) }
        await expect(readPdf(PDF, librariesOf(broken), null)).resolves.toMatchObject({
            code: DocumentRefusalCode.Unreadable,
            cause: expect.objectContaining({ message: "bad stream" }),
        })
        await expect(readPdf(PDF, librariesOf(pdfOf([" 1 ", "2"])), null)).resolves.toMatchObject({
            code: DocumentRefusalCode.TranscriptionUnavailable,
        })
    })
})
