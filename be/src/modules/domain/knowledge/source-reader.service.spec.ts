import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { KnowledgeSourcesService, MAX_UPLOAD_BYTES, StoredNote } from "@modules/domain/knowledge-sources"
import type { SourceRecord } from "@modules/domain/knowledge-sources"
import { DOCUMENTS, DocumentsErrorCode } from "@modules/integrations/documents"
import type { DocumentsPort, DriveAccess, PlacedText } from "@modules/integrations/documents"
import { DRIVE_ACCESS_SOURCE } from "./knowledge.decorators"
import type { DriveAccessSource } from "./knowledge.contracts"
import { SourceReaderService } from "./source-reader.service"

const WS = "11111111-1111-4111-8111-111111111111"

const sourceOf = builder<SourceRecord>({
    id: "s1",
    workspaceId: WS,
    module: "chatbot",
    installationId: null,
    kind: "text",
    topic: null,
    visibility: "internal",
    title: "Hours",
    content: "Open 8 to 21",
    status: "queued",
    storagePath: null,
    sourceUrl: null,
    createdBy: "u1",
    contentHash: null,
    updatedAt: "2026-10-12T10:00:00.000Z",
})

const build = async () => {
    const documents = mock<DocumentsPort>()
    const sources = mock<KnowledgeSourcesService>()
    const driveAccess = mock<DriveAccessSource>()
    const drive = mock<DriveAccess>()
    driveAccess.forWorkspace.mockReturnValue(drive)
    const { forWorkspace } = driveAccess
    const moduleRef = await Test.createTestingModule({
        providers: [
            SourceReaderService,
            { provide: DRIVE_ACCESS_SOURCE, useValue: driveAccess },
            { provide: DOCUMENTS, useValue: documents },
            { provide: KnowledgeSourcesService, useValue: sources },
        ],
    }).compile()
    return { reader: moduleRef.get(SourceReaderService), documents, sources, forWorkspace, drive }
}

describe("SourceReaderService", () => {
    it("takes the text of a note or a Q&A list as it is", async () => {
        const { reader } = await build()

        await expect(reader.read(sourceOf())).resolves.toEqual({
            kind: "ok",
            value: { text: "Open 8 to 21", title: null },
        })
        await expect(reader.read(sourceOf({ kind: "faq" }))).resolves.toMatchObject({ kind: "ok" })
    })
})

describe("SourceReaderService", () => {
    describe("files", () => {
        const file = (patch: Partial<SourceRecord> = {}) =>
            sourceOf({ kind: "file", storagePath: `${WS}/a/menu.pdf`, content: "", ...patch })

        it("reads the object by its file name", async () => {
            const { reader, sources, documents } = await build()
            documents.canReadFileName.mockReturnValue(true)
            sources.readUpload.mockResolvedValue({ bytes: new Uint8Array([1, 2]), contentType: "application/pdf" })
            documents.readPlacedFile.mockResolvedValue({
                text: "Menu text",
                parts: [{ place: null, text: "Menu text" }],
            })

            await expect(reader.read(file())).resolves.toEqual({
                kind: "ok",
                value: { text: "Menu text", title: null },
            })

            expect(documents.canReadFileName).toHaveBeenCalledWith("menu.pdf")
            expect(sources.readUpload).toHaveBeenCalledWith(`${WS}/a/menu.pdf`)
            expect(documents.readPlacedFile).toHaveBeenCalledWith("menu.pdf", new Uint8Array([1, 2]), "application/pdf")
        })

        it("hands on the page, slide or sheet of every stretch when the file names them", async () => {
            const { reader, sources, documents } = await build()
            documents.canReadFileName.mockReturnValue(true)
            sources.readUpload.mockResolvedValue({ bytes: new Uint8Array([1]), contentType: "application/pdf" })
            const parts: ReadonlyArray<PlacedText> = [
                { place: { kind: "page", label: "1" }, text: "One" },
                { place: { kind: "page", label: "2" }, text: "Two" },
            ]
            documents.readPlacedFile.mockResolvedValue({ text: "One\nTwo", parts })

            await expect(reader.read(file())).resolves.toEqual({
                kind: "ok",
                value: { text: "One\nTwo", title: null, parts },
            })
        })

        it("takes the text of a file source that has no object", async () => {
            const { reader, sources } = await build()

            await expect(reader.read(file({ storagePath: null, content: "Old text" }))).resolves.toEqual({
                kind: "ok",
                value: { text: "Old text", title: null },
            })

            expect(sources.readUpload).not.toHaveBeenCalled()
        })

        it("refuses a file source with neither object nor text", async () => {
            const { reader } = await build()

            await expect(reader.read(file({ storagePath: "" }))).resolves.toEqual({
                kind: "refused",
                code: StoredNote.FileMissing,
            })
        })

        it("refuses a file whose type cannot be read", async () => {
            const { reader, documents } = await build()
            documents.canReadFileName.mockReturnValue(false)

            await expect(reader.read(file())).resolves.toEqual({
                kind: "refused",
                code: DocumentsErrorCode.TypeUnsupported,
            })
        })

        it("refuses a file that is not in storage", async () => {
            const { reader, sources, documents } = await build()
            documents.canReadFileName.mockReturnValue(true)
            sources.readUpload.mockResolvedValue(null)

            await expect(reader.read(file())).resolves.toEqual({ kind: "refused", code: StoredNote.FileMissing })
        })
    })
})

describe("SourceReaderService", () => {
    describe("files", () => {
        const file = (patch: Partial<SourceRecord> = {}) =>
            sourceOf({ kind: "file", storagePath: `${WS}/a/menu.pdf`, content: "", ...patch })

        it("refuses a file larger than the bucket allows", async () => {
            const { reader, sources, documents } = await build()
            documents.canReadFileName.mockReturnValue(true)
            sources.readUpload.mockResolvedValue({ bytes: new Uint8Array(MAX_UPLOAD_BYTES + 1), contentType: "x" })

            await expect(reader.read(file())).resolves.toEqual({ kind: "refused", code: StoredNote.FileTooLarge })
        })
    })
})

describe("SourceReaderService", () => {
    describe("links", () => {
        const link = (patch: Partial<SourceRecord> = {}) =>
            sourceOf({
                kind: "url",
                sourceUrl: "https://example.com/page",
                content: "https://example.com/page",
                ...patch,
            })

        it("reads the page with the Drive access of the workspace and keeps a title that was chosen", async () => {
            const { reader, documents, forWorkspace, drive } = await build()
            documents.readLink.mockResolvedValue({ text: "Page text", title: "Page title" })

            await expect(reader.read(link())).resolves.toEqual({
                kind: "ok",
                value: { text: "Page text", title: null },
            })

            expect(forWorkspace).toHaveBeenCalledWith(WS)
            expect(documents.readLink).toHaveBeenCalledWith("https://example.com/page", drive)
        })

        it("takes the title of the page when the title was made from the address", async () => {
            const { reader, documents } = await build()
            documents.readLink.mockResolvedValue({ text: "Page text", title: "T".repeat(200) })

            await expect(reader.read(link({ title: "example.com/page" }))).resolves.toEqual({
                kind: "ok",
                value: { text: "Page text", title: "T".repeat(160) },
            })
        })

        it("takes the title of the page when the title is the address with trailing slashes", async () => {
            const { reader, documents } = await build()
            documents.readLink.mockResolvedValue({ text: "Page text", title: "Menu" })

            await expect(reader.read(link({ title: "https://example.com/page//" }))).resolves.toEqual({
                kind: "ok",
                value: { text: "Page text", title: "Menu" },
            })
        })

        it("takes the title of the page when there was none, reading the address from the content", async () => {
            const { reader, documents, drive } = await build()
            documents.readLink.mockResolvedValue({ text: "Page text", title: "Menu" })

            await expect(reader.read(link({ title: " ", sourceUrl: null }))).resolves.toEqual({
                kind: "ok",
                value: { text: "Page text", title: "Menu" },
            })

            expect(documents.readLink).toHaveBeenCalledWith("https://example.com/page", drive)
        })

        it("keeps the title when the page has none", async () => {
            const { reader, documents } = await build()
            documents.readLink.mockResolvedValue({ text: "Page text", title: null })

            await expect(reader.read(link({ title: "" }))).resolves.toEqual({
                kind: "ok",
                value: { text: "Page text", title: null },
            })
        })

        it("reads a link added by an API key without any Drive access", async () => {
            const { reader, documents, forWorkspace } = await build()
            documents.readLink.mockResolvedValue({ text: "Page text", title: null })

            await reader.read(link({ createdBy: null }))

            expect(forWorkspace).not.toHaveBeenCalled()
            expect(documents.readLink).toHaveBeenCalledWith("https://example.com/page", null)
        })
    })
})
