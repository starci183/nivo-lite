import { readFileSync } from "node:fs"
import { join } from "node:path"
import mammoth from "mammoth"
import { chunkPassages, passageHashOf, passageTextHashOf, reusePlanOf } from "@modules/domain/knowledge-chunks"
import type { EmbeddedChunk } from "@modules/domain/knowledge-chunks"
import { StoredNote } from "@modules/domain/knowledge-sources"
import { DocumentReadersClient, DocumentRefusalCode, DocumentWarningCode } from "@modules/integrations/document-readers"
import type { ReadDocument } from "@modules/integrations/document-readers"
import { DocumentsErrorCode } from "@modules/integrations/documents"
import { layoutOf } from "./passage-layout.policy"
import { noteOfRefusal, partsOfDocument, readingOfDocument, readingOfRefusal } from "./source-reading.policy"
import type { Say } from "./source-reading.policy"

const FIXTURES = join(__dirname, "..", "..", "integrations", "document-readers", "fixtures")

const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(join(FIXTURES, name)))

const say: Say = (key, params) => `${key}${JSON.stringify(params)}`

const AT = new Date("2026-11-11T10:00:00.000Z")

const MODEL = "embed"

/** The readers with the Word library for real; nothing here is a PDF or a picture. */
const readers = new DocumentReadersClient({
    wordToHtml: async (bytes) => (await mammoth.convertToHtml({ buffer: Buffer.from(bytes) })).value,
    openPdf: () => Promise.reject(new Error("unused")),
    pictures: () => Promise.reject(new Error("unused")),
    heicToJpeg: () => Promise.reject(new Error("unused")),
})

/** The passages the index job stores for a file, as `knowledge-indexing` cuts them from what the reader gave. */
const passagesOf = async (name: string): Promise<ReadonlyArray<string>> => {
    const read = await readers.read({ name, mime: "", bytes: fixture(name) }, { transcriber: null })
    if (read.kind !== "ok") throw new Error(read.code)
    return layoutOf(read.value.text, partsOfDocument(read.value)).located.map((piece) => piece.text)
}

/** The passages as the index job stored them: each with the hash of its text and model. */
const storedOf = (passages: ReadonlyArray<string>): Array<EmbeddedChunk> =>
    passages.map((text, order) => ({ id: `p${order}`, order, text, hash: passageHashOf(text, MODEL), model: MODEL }))

const SHEET: ReadDocument = {
    reader: "xlsx",
    text: "## A\n\nx | y\n1 | 2",
    pages: [{ kind: "sheet", label: "A", text: "## A\n\nx | y\n1 | 2", transcribed: false }],
    pageCount: null,
    sheetCount: 2,
    transcribed: false,
    warnings: [{ code: DocumentWarningCode.PlaceEmpty, place: "B", count: null }],
}

describe("source reading policy", () => {
    it("records what the readers read, with each warning in plain words and the object read", () => {
        expect(readingOfDocument(SHEET, say, { path: "ws/1/a.xlsx", at: AT })).toEqual({
            reader: "xlsx",
            pageCount: null,
            sheetCount: 2,
            transcribed: false,
            warnings: [
                {
                    code: DocumentWarningCode.PlaceEmpty,
                    place: "B",
                    count: null,
                    message: 'reading.warning.DOCUMENT_PLACE_EMPTY{"place":"B","count":0}',
                },
            ],
            refusal: null,
            reason: null,
            readAt: "2026-11-11T10:00:00.000Z",
            path: "ws/1/a.xlsx",
        })
    })

    it("keeps at most sixty warnings so a long scan never bloats the stored reading", () => {
        const many = {
            ...SHEET,
            warnings: Array.from({ length: 80 }, () => SHEET.warnings[0]).filter((one) => one !== undefined),
        }
        expect(readingOfDocument(many, say, { path: null, at: AT }).warnings).toHaveLength(60)
    })

    it("records a refusal with its stored note and its plain reason", () => {
        expect(readingOfRefusal(DocumentRefusalCode.NoCredits, say, { path: "p", at: AT })).toMatchObject({
            reader: "file",
            refusal: StoredNote.NoCreditsForTranscription,
            reason: "reading.refusal.DOCUMENT_NO_CREDITS{}",
        })
    })

    it("gives every refusal of the readers a stored note the Knowledge list already knows or a new one", () => {
        expect(Object.values(DocumentRefusalCode).map(noteOfRefusal)).toEqual([
            DocumentsErrorCode.TypeUnsupported,
            StoredNote.LegacyOffice,
            StoredNote.FileTooLarge,
            StoredNote.Unreadable,
            StoredNote.PasswordProtected,
            StoredNote.Empty,
            StoredNote.ReaderUnavailable,
            StoredNote.TranscriptionUnavailable,
            StoredNote.NoCreditsForTranscription,
        ])
    })

    it("hands the chunker the places of a document that names them, and none for one that does not", () => {
        expect(partsOfDocument(SHEET)).toEqual([{ place: { kind: "sheet", label: "A" }, text: "## A\n\nx | y\n1 | 2" }])
        const { pages, ...placeless } = SHEET
        expect(pages).toHaveLength(1)
        expect(partsOfDocument(placeless)).toBeUndefined()
    })
})

describe("partial re-read of a re-uploaded file", () => {
    it("re-embeds only the passage holding the changed cell of a workbook", async () => {
        const before = await passagesOf("price-list.xlsx")
        const after = await passagesOf("price-list-changed.xlsx")
        expect(before.length).toBeGreaterThan(3)
        expect(after).toHaveLength(before.length)

        const plan = reusePlanOf(after, storedOf(before), MODEL)

        expect(plan.missing).toHaveLength(1)
        expect(plan.missing[0]?.text).toContain("Bó hoa mẫu số 33 hồng đỏ | 999000")
        expect(plan.missing[0]?.text.startsWith("Mẫu hoa | Giá (đồng) | Đơn vị | Áp dụng từ\n")).toBe(true)
        expect(plan.moves).toEqual([])
        const changed = after.filter(
            (text, order) => passageHashOf(text, MODEL) !== passageHashOf(before[order] ?? "", MODEL),
        )
        expect(changed).toEqual([plan.missing[0]?.text])
    })

    it("re-embeds only the paragraph that changed in a Word file", async () => {
        const before = await passagesOf("menu.docx")
        const after = await passagesOf("menu-changed.docx")

        const plan = reusePlanOf(after, storedOf(before), MODEL)

        expect(plan.missing.map((piece) => piece.text)).toEqual([
            "# Giao hàng\n\nGiao hàng trong 3 giờ ở nội thành; phí giao 40.000 đồng cho mọi đơn.",
        ])
    })

    it("reads facts again only from the changed passage of the file's text (the model-free hash of the facts job)", async () => {
        const textOf = async (name: string): Promise<string> => {
            const read = await readers.read({ name, mime: "", bytes: fixture(name) }, { transcriber: null })
            return read.kind === "ok" ? read.value.text : ""
        }
        const before = new Set(chunkPassages(await textOf("menu.docx")).map(passageTextHashOf))
        const unread = chunkPassages(await textOf("menu-changed.docx")).filter(
            (text) => !before.has(passageTextHashOf(text)),
        )
        expect(unread).toEqual(["# Giao hàng\n\nGiao hàng trong 3 giờ ở nội thành; phí giao 40.000 đồng cho mọi đơn."])
    })
})
