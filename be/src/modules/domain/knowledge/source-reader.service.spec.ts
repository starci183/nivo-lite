import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock } from "@starci/jest-preset"
import { KnowledgeSourcesService, SourceReadingsService, StoredNote } from "@modules/domain/knowledge-sources"
import type { SourceReading, SourceRecord } from "@modules/domain/knowledge-sources"
import { DOCUMENT_READERS, DocumentRefusalCode, DocumentWarningCode } from "@modules/integrations/document-readers"
import type { DocumentReadersPort, Transcriber } from "@modules/integrations/document-readers"
import { DOCUMENTS, DocumentsErrorCode } from "@modules/integrations/documents"
import type { DocumentsPort, DriveAccess } from "@modules/integrations/documents"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ok, refused } from "@modules/platform/primitives"
import { BANG_GIA_PAGES_VI, BANG_GIA_VI, HONG_35_000_VI } from "@tests/fixtures/i18n/knowledge-spec.messages"
import { DocumentTranscriptionService } from "./document-transcription.service"
import { DRIVE_ACCESS_SOURCE } from "./knowledge.decorators"
import type { DriveAccessSource } from "./knowledge.contracts"
import { SourceReaderService } from "./source-reader.service"

const WS = "11111111-1111-4111-8111-111111111111"

const NOW = "2026-11-11T10:00:00.000Z"

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
    const readers = mock<DocumentReadersPort>()
    const sources = mock<KnowledgeSourcesService>()
    const readings = mock<SourceReadingsService>()
    const transcription = mock<DocumentTranscriptionService>()
    const catalog = mock<MessageCatalog>()
    const driveAccess = mock<DriveAccessSource>()
    const drive = mock<DriveAccess>()
    const transcriber: Transcriber = { transcribe: () => Promise.resolve(ok("")) }
    driveAccess.forWorkspace.mockReturnValue(drive)
    transcription.transcriberFor.mockReturnValue(transcriber)
    readers.acceptsName.mockReturnValue(true)
    readings.reading.mockResolvedValue(null)
    catalog.get.mockImplementation((key, params) => `${key}${JSON.stringify(params)}`)
    const { forWorkspace } = driveAccess
    const moduleRef = await Test.createTestingModule({
        providers: [
            SourceReaderService,
            { provide: DRIVE_ACCESS_SOURCE, useValue: driveAccess },
            { provide: DOCUMENTS, useValue: documents },
            { provide: DOCUMENT_READERS, useValue: readers },
            { provide: DocumentTranscriptionService, useValue: transcription },
            { provide: KnowledgeSourcesService, useValue: sources },
            { provide: SourceReadingsService, useValue: readings },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return {
        reader: moduleRef.get(SourceReaderService),
        documents,
        readers,
        sources,
        readings,
        transcription,
        transcriber,
        forWorkspace,
        drive,
    }
}

/** The reading the source recorded last. */
const recorded = (readings: ReturnType<typeof mock<SourceReadingsService>>): SourceReading | undefined =>
    readings.record.mock.calls.at(-1)?.[2]

describe("SourceReaderService", () => {
    it("takes the text of a note or a Q&A list as it is", async () => {
        const { reader, readings } = await build()

        await expect(reader.read(sourceOf())).resolves.toEqual({
            kind: "ok",
            value: { text: "Open 8 to 21", title: null },
        })
        await expect(reader.read(sourceOf({ kind: "faq" }))).resolves.toMatchObject({ kind: "ok" })
        expect(readings.record).not.toHaveBeenCalled()
    })
})

/** A file source with its object in storage. */
const file = (patch: Partial<SourceRecord> = {}) =>
    sourceOf({ kind: "file", storagePath: `${WS}/a/bang-gia.pdf`, content: "", ...patch })

describe("SourceReaderService: files and their pages", () => {
    it("reads the object through the document readers with the workspace's transcriber, keeps its pages and records the reading", async () => {
        const { reader, sources, readers, readings, transcription, transcriber } = await build()
        sources.readUpload.mockResolvedValue({ bytes: new Uint8Array([1, 2]), contentType: "application/pdf" })
        readers.read.mockResolvedValue(
            ok({
                reader: "pdf",
                text: BANG_GIA_PAGES_VI,
                pages: [
                    { kind: "page", label: "1", text: BANG_GIA_VI, transcribed: false },
                    { kind: "page", label: "2", text: HONG_35_000_VI, transcribed: true },
                ],
                pageCount: 2,
                sheetCount: null,
                transcribed: true,
                warnings: [{ code: DocumentWarningCode.PageTranscribed, place: "2", count: null }],
            }),
        )

        await expect(reader.read(file())).resolves.toEqual({
            kind: "ok",
            value: {
                text: BANG_GIA_PAGES_VI,
                title: null,
                parts: [
                    { place: { kind: "page", label: "1" }, text: BANG_GIA_VI },
                    { place: { kind: "page", label: "2" }, text: HONG_35_000_VI },
                ],
            },
        })

        expect(sources.readUpload).toHaveBeenCalledWith(`${WS}/a/bang-gia.pdf`)
        expect(transcription.transcriberFor).toHaveBeenCalledWith(WS)
        expect(readers.read).toHaveBeenCalledWith(
            { name: "bang-gia.pdf", mime: "application/pdf", bytes: new Uint8Array([1, 2]) },
            { transcriber },
        )
        expect(readings.record).toHaveBeenCalledWith(WS, "s1", {
            reader: "pdf",
            pageCount: 2,
            sheetCount: null,
            transcribed: true,
            warnings: [
                {
                    code: DocumentWarningCode.PageTranscribed,
                    place: "2",
                    count: null,
                    message: 'reading.warning.DOCUMENT_PAGE_TRANSCRIBED{"place":"2","count":0,"left":0}',
                },
            ],
            refusal: null,
            reason: null,
            readAt: NOW,
            path: `${WS}/a/bang-gia.pdf`,
        })
    })

    it("keeps a document without places as one stretch with none", async () => {
        const { reader, sources, readers } = await build()
        sources.readUpload.mockResolvedValue({ bytes: new Uint8Array([1]), contentType: "text/plain" })
        readers.read.mockResolvedValue(
            ok({
                reader: "text",
                text: "Menu",
                pageCount: null,
                sheetCount: null,
                transcribed: false,
                warnings: [],
            }),
        )

        await expect(reader.read(file({ storagePath: `${WS}/a/menu.txt` }))).resolves.toEqual({
            kind: "ok",
            value: { text: "Menu", title: null },
        })
    })
})

describe("SourceReaderService: refused and reused files", () => {
    it("closes a refused file with its stored note and records the plain reason for the owner", async () => {
        const { reader, sources, readers, readings } = await build()
        sources.readUpload.mockResolvedValue({ bytes: new Uint8Array([1]), contentType: "application/pdf" })
        readers.read.mockResolvedValue(refused(DocumentRefusalCode.PasswordProtected))

        await expect(reader.read(file())).resolves.toEqual({
            kind: "refused",
            code: StoredNote.PasswordProtected,
            params: undefined,
        })
        expect(recorded(readings)).toEqual({
            reader: "file",
            pageCount: null,
            sheetCount: null,
            transcribed: false,
            warnings: [],
            refusal: StoredNote.PasswordProtected,
            reason: "reading.refusal.DOCUMENT_PASSWORD_PROTECTED{}",
            readAt: NOW,
            path: `${WS}/a/bang-gia.pdf`,
        })
    })

    it("refuses a file whose type no reader takes, before downloading it", async () => {
        const { reader, sources, readers, readings } = await build()
        readers.acceptsName.mockReturnValue(false)

        await expect(reader.read(file({ storagePath: `${WS}/a/tool.exe` }))).resolves.toMatchObject({
            kind: "refused",
            code: DocumentsErrorCode.TypeUnsupported,
        })
        expect(sources.readUpload).not.toHaveBeenCalled()
        expect(recorded(readings)?.reason).toBe("reading.refusal.DOCUMENT_TYPE_UNSUPPORTED{}")
    })

    it("reuses the transcribed text of the same object when the job runs again before it finished, paying nothing twice", async () => {
        const { reader, sources, readers, readings } = await build()
        const path = `${WS}/a/bang-gia.pdf`
        readings.reading.mockResolvedValue({
            reader: "pdf",
            pageCount: 1,
            sheetCount: null,
            transcribed: true,
            warnings: [],
            refusal: null,
            reason: null,
            readAt: NOW,
            path,
        })

        await expect(reader.read(file({ content: HONG_35_000_VI }))).resolves.toEqual({
            kind: "ok",
            value: { text: HONG_35_000_VI, title: null },
        })
        expect(readers.read).not.toHaveBeenCalled()
        expect(sources.readUpload).not.toHaveBeenCalled()
    })
})

describe("SourceReaderService: new uploads and files without an object", () => {
    it("reads a new upload again even when the old one was transcribed", async () => {
        const { reader, sources, readers, readings } = await build()
        readings.reading.mockResolvedValue({
            reader: "image",
            pageCount: 1,
            sheetCount: null,
            transcribed: true,
            warnings: [],
            refusal: null,
            reason: null,
            readAt: NOW,
            path: `${WS}/old/bang-gia.jpg`,
        })
        sources.readUpload.mockResolvedValue({ bytes: new Uint8Array([1]), contentType: "image/jpeg" })
        readers.read.mockResolvedValue(refused(DocumentRefusalCode.NoText))

        await expect(
            reader.read(file({ storagePath: `${WS}/new/bang-gia.jpg`, content: "old" })),
        ).resolves.toMatchObject({
            code: StoredNote.Empty,
        })
        expect(readers.read).toHaveBeenCalled()
    })

    it("does not look for an earlier reading of a fresh file or of a finished text", async () => {
        const { reader, sources, readers, readings } = await build()
        sources.readUpload.mockResolvedValue(null)

        await reader.read(file())
        await reader.read(file({ content: "done", contentHash: "abc" }))

        expect(readings.reading).not.toHaveBeenCalled()
        expect(readers.read).not.toHaveBeenCalled()
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

    it("refuses a file that is not in storage", async () => {
        const { reader, sources } = await build()
        sources.readUpload.mockResolvedValue(null)

        await expect(reader.read(file())).resolves.toEqual({ kind: "refused", code: StoredNote.FileMissing })
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
