import { Test } from "@nestjs/testing"
import { fileTextKind, hasExtension, sniffTextKind } from "./text-kind.policy"

const SUBJECT = Symbol("text-kind.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { fileTextKind, hasExtension, sniffTextKind } }],
    }).compile()
    return moduleRef.get<typeof import("./text-kind.policy")>(SUBJECT)
}

const bytesOf = (text: string): Uint8Array => new TextEncoder().encode(text)

describe("fileTextKind", () => {
    it.each([
        ["menu.pdf", "pdf"],
        ["notes.DOCX", "docx"],
        ["prices.xlsx", "xlsx"],
        ["deck.pptx", "pptx"],
        ["a.txt", "text"],
        ["a.md", "text"],
        ["a.markdown", "text"],
        ["a.csv", "text"],
    ])("reads %s as %s", async (name, kind) => {
        const subject = await build()

        expect(subject.fileTextKind(name)).toBe(kind)
    })

    it("cannot read another extension or a name without one", async () => {
        const subject = await build()

        expect(subject.fileTextKind("photo.png")).toBeNull()
        expect(subject.fileTextKind("README")).toBeNull()
    })
})

describe("hasExtension", () => {
    it("tells a name with an extension from one without", async () => {
        const subject = await build()

        expect(subject.hasExtension("a.png")).toBe(true)
        expect(subject.hasExtension("a")).toBe(false)
    })
})

describe("sniffTextKind", () => {
    it("recognises a PDF by its header whatever the content type", async () => {
        const subject = await build()

        expect(subject.sniffTextKind(bytesOf("%PDF-1.7 rest"), "application/octet-stream")).toBe("pdf")
    })

    it.each([
        ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
        ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
        ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"],
        ["text/plain; charset=utf-8", "text"],
        ["text/csv", "text"],
        ["application/json", "text"],
        ["application/xml", "text"],
    ])("recognises the content type %s as %s", async (contentType, kind) => {
        const subject = await build()

        expect(subject.sniffTextKind(bytesOf("body"), contentType)).toBe(kind)
    })

    it("does not take a web page or an unknown type for text", async () => {
        const subject = await build()

        expect(subject.sniffTextKind(bytesOf("<html>"), "text/html")).toBeNull()
        expect(subject.sniffTextKind(bytesOf("body"), "image/png")).toBeNull()
    })
})
