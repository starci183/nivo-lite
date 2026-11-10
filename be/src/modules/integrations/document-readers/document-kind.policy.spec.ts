import { readFileSync } from "node:fs"
import { join } from "node:path"
import { DocumentRefusalCode } from "./document-readers.contracts"
import { acceptsName, extensionOf, isLockedOffice, kindOf } from "./document-kind.policy"

const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(join(__dirname, "fixtures", name)))

const NONE = new Uint8Array([1, 2, 3])

describe("document kind policy", () => {
    it("picks the reader by extension, whatever the case", () => {
        expect(kindOf("Bang-gia.XLSX", "", NONE)).toEqual({ kind: "reader", reader: "xlsx" })
        expect(kindOf("menu.docx", "", NONE)).toEqual({ kind: "reader", reader: "docx" })
        expect(kindOf("a.md", "", NONE)).toEqual({ kind: "reader", reader: "markdown" })
        expect(kindOf("a.tsv", "", NONE)).toEqual({ kind: "reader", reader: "tsv" })
        expect(kindOf("a.htm", "", NONE)).toEqual({ kind: "reader", reader: "html" })
        expect(kindOf("anh-bang-gia.jpeg", "", NONE)).toEqual({ kind: "reader", reader: "image" })
        expect(kindOf("IMG_0001.HEIC", "", NONE)).toEqual({ kind: "reader", reader: "heic" })
    })

    it("refuses an old Office file with its own code and an unknown extension as unsupported, never sniffing it", () => {
        expect(kindOf("bang-gia.xls", "", NONE)).toEqual({ kind: "refused", code: DocumentRefusalCode.LegacyOffice })
        expect(kindOf("hop-dong.doc", "", NONE)).toEqual({ kind: "refused", code: DocumentRefusalCode.LegacyOffice })
        expect(kindOf("tool.exe", "application/pdf", new TextEncoder().encode("%PDF-1.4"))).toEqual({
            kind: "refused",
            code: DocumentRefusalCode.TypeUnsupported,
        })
    })

    it("knows a file without an extension by its first bytes, then by its content type", () => {
        expect(kindOf("scan", "", new TextEncoder().encode("%PDF-1.7"))).toEqual({ kind: "reader", reader: "pdf" })
        expect(kindOf("photo", "", fixture("price-photo.jpg"))).toEqual({ kind: "reader", reader: "image" })
        expect(kindOf("photo", "", new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toEqual({
            kind: "reader",
            reader: "image",
        })
        expect(kindOf("anim", "", new TextEncoder().encode("GIF89a"))).toEqual({ kind: "reader", reader: "image" })
        expect(kindOf("pic", "", new TextEncoder().encode("RIFF0000WEBPVP8 "))).toEqual({
            kind: "reader",
            reader: "image",
        })
        expect(kindOf("export", "text/csv; charset=utf-8", NONE)).toEqual({ kind: "reader", reader: "csv" })
        expect(kindOf("export", "text/tab-separated-values", NONE)).toEqual({ kind: "reader", reader: "tsv" })
        expect(kindOf("page", "text/html", NONE)).toEqual({ kind: "reader", reader: "html" })
        expect(kindOf("notes", "text/markdown", NONE)).toEqual({ kind: "reader", reader: "markdown" })
        expect(kindOf("notes", "text/plain", NONE)).toEqual({ kind: "reader", reader: "text" })
        expect(kindOf("photo", "image/heic", NONE)).toEqual({ kind: "reader", reader: "heic" })
        expect(kindOf("doc", "application/pdf", NONE)).toEqual({ kind: "reader", reader: "pdf" })
        expect(kindOf("doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", NONE)).toEqual({
            kind: "reader",
            reader: "docx",
        })
        expect(kindOf("doc", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", NONE)).toEqual({
            kind: "reader",
            reader: "xlsx",
        })
        expect(
            kindOf("doc", "application/vnd.openxmlformats-officedocument.presentationml.presentation", NONE),
        ).toEqual({
            kind: "reader",
            reader: "pptx",
        })
        expect(kindOf("blob", "application/octet-stream", NONE)).toEqual({
            kind: "refused",
            code: DocumentRefusalCode.TypeUnsupported,
        })
        expect(kindOf("blob", "", NONE)).toEqual({ kind: "refused", code: DocumentRefusalCode.TypeUnsupported })
    })

    it("takes at the door every readable name, old Office names (refused later with advice) and names without an extension", () => {
        expect(acceptsName("bang-gia.xlsx")).toBe(true)
        expect(acceptsName("bang-gia.xls")).toBe(true)
        expect(acceptsName("scan")).toBe(true)
        expect(acceptsName("virus.exe")).toBe(false)
        expect(extensionOf("  a.b.PDF ")).toBe("pdf")
    })

    it("tells a password-locked Office file from an old binary one", () => {
        expect(isLockedOffice(fixture("locked.docx"))).toBe(true)
        expect(isLockedOffice(fixture("legacy.doc"))).toBe(false)
    })
})
