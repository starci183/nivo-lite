import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import mammoth from "mammoth"
import sharp from "sharp"
import { ok } from "@modules/platform/primitives"
import { DOCUMENT_MAX_BYTES, DocumentRefusalCode } from "./document-readers.contracts"
import { DocumentReadersError, DocumentReadersErrorCode } from "./errors/document-readers.error"
import type { DocumentLibraries, DocumentReadOutcome, ReadOptions, Transcriber } from "./document-readers.contracts"
import { pictureToolsOf } from "./document-libraries.adapter"
import { DocumentReadersClient } from "./document-readers.client"
import { DOCUMENT_LIBRARIES } from "./document-readers.decorators"

const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(join(__dirname, "fixtures", name)))

/** The installed libraries for real, a scripted PDF (pdf.js cannot load in the unit runner), no HEIC decoder. */
const libraries: DocumentLibraries = {
    wordToHtml: async (bytes) => (await mammoth.convertToHtml({ buffer: Buffer.from(bytes) })).value,
    openPdf: () =>
        Promise.resolve({
            pageCount: 1,
            pageTexts: () => Promise.resolve(["B\u1EA3ng gi\u00E1 PDF"]),
            pageImages: () => Promise.resolve([]),
            renderPage: () => Promise.resolve(null),
        }),
    pictures: () => Promise.resolve(pictureToolsOf(sharp)),
    heicToJpeg: () => Promise.reject(new DocumentReadersError({ code: DocumentReadersErrorCode.LibraryMissing, params: { library: "heic-convert" } })),
}

const transcriber: Transcriber = { transcribe: () => Promise.resolve(ok("H\u1ED3ng | 35.000")) }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [DocumentReadersClient, { provide: DOCUMENT_LIBRARIES, useValue: libraries }],
    }).compile()
    const client = moduleRef.get(DocumentReadersClient)
    const options: ReadOptions = { transcriber }
    const read = (name: string, bytes: Uint8Array, mime = ""): Promise<DocumentReadOutcome> =>
        client.read({ name, mime, bytes }, options)
    return { client, read }
}

/** The text of a read, or the refusal code. */
const textOf = (read: DocumentReadOutcome): string => (read.kind === "ok" ? read.value.text : read.code)

describe("DocumentReadersClient", () => {
    it("reads every kind with what is installed today", async () => {
        const { read } = await build()
        expect(textOf(await read("prices.csv", fixture("prices.csv")))).toBe(
            'M\u00F3n | Gi\u00E1 | Ghi ch\u00FA\nB\u00F3 h\u1ED3ng \u0111\u1ECF | 350.000 | C\u00F3 "thi\u1EC7p"; giao nhanh\nL\u1EB5ng h\u01B0\u1EDBng d\u01B0\u01A1ng | 520.000\nHoa c\u01B0\u1EDBi | 1.200.000 | \u0111\u1EB7t tr\u01B0\u1EDBc',
        )
        expect(textOf(await read("prices.tsv", fixture("prices.tsv")))).toBe(
            "M\u00F3n | Gi\u00E1\nB\u00F3 c\u00FAc/tr\u1EAFng | 150.000\nHoa lan | 800.000",
        )
        expect(textOf(await read("notes.txt", fixture("notes.txt")))).toBe(
            "Ghi ch\u00FA: m\u1EDF c\u1EEDa 7 gi\u1EDD.\nNgh\u1EC9 T\u1EBFt t\u1EEB 28 \u0111\u1EBFn m\u00F9ng 4.",
        )
        const markdown = await read("policy.md", fixture("policy.md"))
        expect(markdown).toMatchObject({
            kind: "ok",
            value: { reader: "markdown", sections: [{ heading: "Ch\u00EDnh s\u00E1ch \u0111\u1ED5i tr\u1EA3" }, { heading: "Ho\u00E0n ti\u1EC1n" }] },
        })
        expect(await read("about.html", fixture("about.html"))).toMatchObject({
            kind: "ok",
            value: { reader: "html", tables: [{ header: ["M\u00F3n", "Gi\u00E1"] }] },
        })
        expect(await read("menu.docx", fixture("menu.docx"))).toMatchObject({ kind: "ok", value: { reader: "docx" } })
        expect(await read("price-list.xlsx", fixture("price-list.xlsx"))).toMatchObject({
            kind: "ok",
            value: { reader: "xlsx", sheetCount: 3 },
        })
        expect(await read("slides.pptx", fixture("slides.pptx"))).toMatchObject({
            kind: "ok",
            value: { reader: "pptx", pageCount: 3 },
        })
        expect(await read("bang-gia.pdf", new TextEncoder().encode("%PDF-1.4"))).toMatchObject({
            kind: "ok",
            value: { reader: "pdf", text: "B\u1EA3ng gi\u00E1 PDF" },
        })
        expect(await read("anh-bang-gia.jpg", fixture("price-photo.jpg"))).toMatchObject({
            kind: "ok",
            value: { reader: "image", text: "H\u1ED3ng | 35.000", transcribed: true },
        })
        expect(await read("export", fixture("prices.csv"), "text/csv")).toMatchObject({
            kind: "ok",
            value: { reader: "csv" },
        })
    })

    it("refuses honestly: too big, empty, old Office, unknown type, locked, binary text, no text at all, HEIC without its decoder", async () => {
        const { read, client } = await build()
        expect(textOf(await read("a.pdf", new Uint8Array(DOCUMENT_MAX_BYTES + 1)))).toBe(DocumentRefusalCode.TooLarge)
        expect(textOf(await read("a.txt", new Uint8Array(0)))).toBe(DocumentRefusalCode.NoText)
        expect(textOf(await read("bang-gia.xls", fixture("legacy.doc")))).toBe(DocumentRefusalCode.LegacyOffice)
        expect(textOf(await read("tool.exe", fixture("notes.txt")))).toBe(DocumentRefusalCode.TypeUnsupported)
        expect(textOf(await read("menu.docx", fixture("locked.docx")))).toBe(DocumentRefusalCode.PasswordProtected)
        expect(textOf(await read("notes.txt", new Uint8Array([0x41, 0, 0x42])))).toBe(DocumentRefusalCode.Unreadable)
        expect(textOf(await read("blank.md", new TextEncoder().encode("  \n--- \n * ")))).toBe(
            DocumentRefusalCode.NoText,
        )
        expect(textOf(await read("empty.csv", new TextEncoder().encode(";;\n;;\n")))).toBe(DocumentRefusalCode.NoText)
        expect(textOf(await read("IMG_1.HEIC", fixture("price-photo.jpg")))).toBe(DocumentRefusalCode.ReaderUnavailable)
        expect(client.acceptsName("menu.docx")).toBe(true)
        expect(client.acceptsName("virus.exe")).toBe(false)
    })
})
