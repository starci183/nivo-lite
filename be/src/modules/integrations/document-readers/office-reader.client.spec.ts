import { readFileSync } from "node:fs"
import { join } from "node:path"
import mammoth from "mammoth"
import { strToU8, zipSync } from "fflate"
import { DocumentRefusalCode } from "./document-readers.contracts"
import { DocumentReadersError, DocumentReadersErrorCode } from "./errors/document-readers.error"
import type { DocumentLibraries } from "./document-readers.contracts"
import { readSlides, readWord, readWorkbook } from "./office-reader.client"

const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(join(__dirname, "fixtures", name)))

/** The Word library for real; the others are never reached by these readers. */
const libraries: DocumentLibraries = {
    wordToHtml: async (bytes) => (await mammoth.convertToHtml({ buffer: Buffer.from(bytes) })).value,
    openPdf: () => Promise.reject(new DocumentReadersError({ code: DocumentReadersErrorCode.LibraryMissing, params: { library: "unused" } })),
    pictures: () => Promise.reject(new DocumentReadersError({ code: DocumentReadersErrorCode.LibraryMissing, params: { library: "unused" } })),
    heicToJpeg: () => Promise.reject(new DocumentReadersError({ code: DocumentReadersErrorCode.LibraryMissing, params: { library: "unused" } })),
}

describe("office readers", () => {
    it("reads a Word file into headings, paragraphs and its price table with the header first", async () => {
        const read = await readWord(fixture("menu.docx"), libraries)
        expect(read).toMatchObject({ kind: "ok" })
        if (read.kind !== "ok") return
        expect(read.value.text).toBe(
            [
                "# Gi\u1EDD m\u1EDF c\u1EEDa",
                "",
                "Ti\u1EC7m m\u1EDF c\u1EEDa t\u1EEB 7 gi\u1EDD s\u00E1ng \u0111\u1EBFn 21 gi\u1EDD t\u1ED1i, t\u1EA5t c\u1EA3 c\u00E1c ng\u00E0y trong tu\u1EA7n, k\u1EC3 c\u1EA3 Ch\u1EE7 nh\u1EADt v\u00E0 ng\u00E0y l\u1EC5.",
                "",
                "# Giao h\u00E0ng",
                "",
                "Giao h\u00E0ng trong 2 gi\u1EDD \u1EDF n\u1ED9i th\u00E0nh; ph\u00ED giao 30.000 \u0111\u1ED3ng, mi\u1EC5n ph\u00ED cho \u0111\u01A1n t\u1EEB 500.000 \u0111\u1ED3ng.",
                "",
                "# B\u1EA3ng gi\u00E1",
                "",
                "M\u00F3n | Gi\u00E1",
                "B\u00F3 h\u1ED3ng \u0111\u1ECF 10 b\u00F4ng | 350.000",
                "L\u1EB5ng h\u01B0\u1EDBng d\u01B0\u01A1ng | 520.000",
            ].join("\n"),
        )
        expect(read.value.sections?.map((section) => section.heading)).toEqual(["Gi\u1EDD m\u1EDF c\u1EEDa", "Giao h\u00E0ng", "B\u1EA3ng gi\u00E1"])
        expect(read.value.tables).toHaveLength(1)
        expect(read.value).toMatchObject({ reader: "docx", pageCount: null, transcribed: false, warnings: [] })
    })

    it("refuses a locked Word file, an old .doc saved under a new name, and bytes that are no archive", async () => {
        await expect(readWord(fixture("locked.docx"), libraries)).resolves.toEqual({
            kind: "refused",
            code: DocumentRefusalCode.PasswordProtected,
            params: undefined,
        })
        await expect(readWord(fixture("legacy.doc"), libraries)).resolves.toMatchObject({
            code: DocumentRefusalCode.LegacyOffice,
        })
        await expect(readWord(new TextEncoder().encode("plain"), libraries)).resolves.toMatchObject({
            code: DocumentRefusalCode.Unreadable,
        })
        const broken = zipSync({ "x.txt": strToU8("x") })
        await expect(readWord(broken, libraries)).resolves.toMatchObject({ code: DocumentRefusalCode.Unreadable })
    })

    it("reads a workbook sheet by sheet with the sheet count, and refuses a locked or broken one", () => {
        const read = readWorkbook(fixture("price-list.xlsx"))
        expect(read).toMatchObject({ kind: "ok", value: { reader: "xlsx", sheetCount: 3, transcribed: false } })
        if (read.kind === "ok") expect(read.value.text.startsWith("## B\u1EA3ng gi\u00E1\n\nM\u1EABu hoa | Gi\u00E1 (\u0111\u1ED3ng)")).toBe(true)
        expect(readWorkbook(fixture("locked.docx"))).toMatchObject({ code: DocumentRefusalCode.PasswordProtected })
        expect(readWorkbook(zipSync({ "a.xml": strToU8("<a/>") }))).toMatchObject({
            code: DocumentRefusalCode.Unreadable,
            cause: expect.objectContaining({ code: DocumentReadersErrorCode.NotWorkbook }),
        })
    })

    it("reads a presentation slide by slide with the slide count, and refuses one that is no presentation", () => {
        const read = readSlides(fixture("slides.pptx"))
        expect(read).toMatchObject({ kind: "ok", value: { reader: "pptx", pageCount: 3 } })
        if (read.kind === "ok") {
            expect(read.value.text).toBe("Khuy\u1EBFn m\u00E3i th\u00E1ng 11\nGi\u1EA3m 10% cho hoa sinh nh\u1EADt\n\nLi\u00EAn h\u1EC7: 0901 234 567")
        }
        expect(readSlides(fixture("price-list.xlsx"))).toMatchObject({
            code: DocumentRefusalCode.Unreadable,
            cause: expect.objectContaining({ code: DocumentReadersErrorCode.NotPresentation }),
        })
        expect(readSlides(fixture("legacy.doc"))).toMatchObject({ code: DocumentRefusalCode.LegacyOffice })
    })
})
