import { Test } from "@nestjs/testing"
import { strToU8, zipSync } from "fflate"
import { mock } from "@starci/jest-preset"
import type { DocumentReaders } from "./documents.contracts"
import { DocumentsErrorCode } from "./errors/documents.error"
import { textFromBytes } from "./text-extraction.mapper"

const SUBJECT = Symbol("text-extraction.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { textFromBytes } }],
    }).compile()
    return moduleRef.get<typeof import("./text-extraction.mapper")>(SUBJECT)
}

const encode = (text: string): Uint8Array => new TextEncoder().encode(text)

const zipOf = (parts: Readonly<Record<string, string>>): Uint8Array =>
    zipSync(Object.fromEntries(Object.entries(parts).map(([name, xml]) => [name, strToU8(xml)])))

const ZIP = zipOf({ "word/document.xml": "<w:document/>" })
const PDF = encode("%PDF-1.4 body")

describe("textFromBytes", () => {
    describe("text", () => {
        it("decodes UTF-8 and drops its byte order mark", async () => {
            const subject = await build()

            await expect(
                subject.textFromBytes("text", encode("\ufeffCaf\u00e9"), mock<DocumentReaders>()),
            ).resolves.toBe("Caf\u00e9")
        })

        it.each([
            ["little endian", [0xff, 0xfe, 0x68, 0x00, 0x69, 0x00]],
            ["big endian", [0xfe, 0xff, 0x00, 0x68, 0x00, 0x69]],
        ])("decodes UTF-16 %s", async (_name, bytes) => {
            const subject = await build()

            await expect(subject.textFromBytes("text", Uint8Array.from(bytes), mock<DocumentReaders>())).resolves.toBe(
                "hi",
            )
        })

        it("refuses a body with a NUL byte that is not UTF-16", async () => {
            const subject = await build()

            await expect(
                subject.textFromBytes("text", Uint8Array.from([0x61, 0x00, 0x62]), mock<DocumentReaders>()),
            ).rejects.toMatchObject({ code: DocumentsErrorCode.FileInvalid, params: { kind: "text" } })
        })

        it("lets a first byte that looks like the start of a byte order mark but is not one decode as UTF-8", async () => {
            const subject = await build()

            await expect(
                subject.textFromBytes("text", Uint8Array.from([0xff, 0x41]), mock<DocumentReaders>()),
            ).resolves.toContain("A")
            await expect(
                subject.textFromBytes("text", Uint8Array.from([0xfe, 0x41]), mock<DocumentReaders>()),
            ).resolves.toContain("A")
        })
    })
})

describe("textFromBytes", () => {
    describe("docx", () => {
        it("reads a Word file through the docx reader", async () => {
            const subject = await build()

            const readers = mock<DocumentReaders>()
            readers.docx.mockResolvedValue("Hello Word")

            await expect(subject.textFromBytes("docx", ZIP, readers)).resolves.toBe("Hello Word")

            expect(readers.docx).toHaveBeenCalledWith(ZIP)
        })

        it("refuses a body that is not a zip", async () => {
            const subject = await build()

            await expect(subject.textFromBytes("docx", encode("nope"), mock<DocumentReaders>())).rejects.toMatchObject({
                code: DocumentsErrorCode.FileInvalid,
                params: { kind: "docx" },
            })
        })

        it("reports a reader failure as unreadable and keeps the cause", async () => {
            const subject = await build()

            const readers = mock<DocumentReaders>()
            const failure = new Error("bad archive")
            readers.docx.mockRejectedValue(failure)

            await expect(subject.textFromBytes("docx", ZIP, readers)).rejects.toMatchObject({
                code: DocumentsErrorCode.FileUnreadable,
                params: { kind: "docx" },
                cause: failure,
            })
        })
    })
})

describe("textFromBytes", () => {
    describe("xlsx and pptx", () => {
        it("reads a workbook", async () => {
            const subject = await build()

            const bytes = zipOf({
                "xl/workbook.xml": '<workbook><sheet name="S"/></workbook>',
                "xl/worksheets/sheet1.xml": "<worksheet><row><c><v>1</v></c></row></worksheet>",
            })

            await expect(subject.textFromBytes("xlsx", bytes, mock<DocumentReaders>())).resolves.toBe("## S\n1")
        })

        it("reads a presentation", async () => {
            const subject = await build()

            const bytes = zipOf({ "ppt/slides/slide1.xml": "<p:sld><a:p><a:r><a:t>Hi</a:t></a:r></a:p></p:sld>" })

            await expect(subject.textFromBytes("pptx", bytes, mock<DocumentReaders>())).resolves.toBe("## Slide 1\nHi")
        })

        it.each(["xlsx", "pptx"] as const)("reports a %s archive without its parts as unreadable", async (kind) => {
            const subject = await build()

            await expect(
                subject.textFromBytes(kind, zipOf({ "other.xml": "<a/>" }), mock<DocumentReaders>()),
            ).rejects.toMatchObject({ code: DocumentsErrorCode.FileUnreadable, params: { kind } })
        })

        it("refuses a body that is not a zip", async () => {
            const subject = await build()

            await expect(subject.textFromBytes("xlsx", encode("nope"), mock<DocumentReaders>())).rejects.toMatchObject({
                code: DocumentsErrorCode.FileInvalid,
            })
        })
    })
})

describe("textFromBytes", () => {
    describe("pdf", () => {
        it("reads a PDF through the pdf reader", async () => {
            const subject = await build()

            const readers = mock<DocumentReaders>()
            readers.pdf.mockResolvedValue("Hello PDF")

            await expect(subject.textFromBytes("pdf", PDF, readers)).resolves.toBe("Hello PDF")
        })

        it("refuses a body without the PDF header", async () => {
            const subject = await build()

            await expect(subject.textFromBytes("pdf", encode("nope"), mock<DocumentReaders>())).rejects.toMatchObject({
                code: DocumentsErrorCode.FileInvalid,
                params: { kind: "pdf" },
            })
        })

        it("reports a reader failure as unreadable", async () => {
            const subject = await build()

            const readers = mock<DocumentReaders>()
            readers.pdf.mockRejectedValue(new Error("locked"))

            await expect(subject.textFromBytes("pdf", PDF, readers)).rejects.toMatchObject({
                code: DocumentsErrorCode.FileUnreadable,
                params: { kind: "pdf" },
            })
        })
    })
})
