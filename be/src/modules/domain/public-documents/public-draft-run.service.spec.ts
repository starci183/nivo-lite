import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { UsageMeterService } from "@modules/domain/knowledge"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"
import type { SourceDocument } from "@modules/domain/knowledge-sources"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import {
    WS,
    brainDocumentOf,
    documentRow,
    documentSourceRow,
    publicDraftingAnswers,
} from "@tests/fixtures/builders/public-documents.builder"
import { MAX_SHOWN_CHARS } from "./draft-sources.policy"
import { PublicDocumentsErrorCode } from "./errors/public-documents.error"
import { InternalReaderService } from "./internal-reader.service"
import { PublicDocumentEntity, PublicDocumentSourceEntity } from "./persistence/entities"
import { PublicDraftRunService } from "./public-draft-run.service"
import { PublicDraftWriterService } from "./public-draft-writer.service"

const codes = PublicDocumentsErrorCode
const payload = { documentId: "d1", workspaceId: WS, draftRevision: 0 }

/** A document NIVO is drafting for the owner, with a note and no text yet. */
const rowOf = (changes: Parameters<typeof documentRow>[0] = {}) =>
    documentRow({ status: "drafting", body: "", instructions: "Keep it short", ...changes })
const sourceRow = (sourceId: string) => documentSourceRow({ sourceId, sourceTitle: "old", contentHash: "old" })
/** A ready document of a bicycle workshop's Brain (synthetic data), in the public area unless named otherwise. */
const docOf = (id: string, content: string, visibility = "public"): SourceDocument =>
    brainDocumentOf({ id, title: `Document ${id}`, contentHash: `h-${id}`, content, visibility })

const REPAIR = "Flat tyre repair while you wait."
const REPAIRED = "Flat tyres are repaired while you wait."

const build = async (em: MockEntityManager, shelf: ReadonlyArray<SourceDocument> = []) => {
    const reader = mock<InternalReaderService>()
    const sources = mock<KnowledgeSourcesReadService>()
    sources.statesOf.mockImplementation((_ws, ids) =>
        Promise.resolve(
            shelf
                .filter((doc) => ids.includes(doc.id))
                .map(({ id, title, visibility, status, contentHash }) => ({ id, title, visibility, status, contentHash })),
        ),
    )
    sources.textOf.mockImplementation((_ws, id) => Promise.resolve(shelf.find((doc) => doc.id === id) ?? null))
    const writer = mock<PublicDraftWriterService>()
    const usage = mock<UsageMeterService>()
    usage.blockedBy.mockResolvedValue(false)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PublicDraftRunService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: InternalReaderService, useValue: reader },
            { provide: KnowledgeSourcesReadService, useValue: sources },
            { provide: PublicDraftWriterService, useValue: writer },
            { provide: UsageMeterService, useValue: usage },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { run: moduleRef.get(PublicDraftRunService), reader, sources, writer, usage, logger }
}

/** A transaction over a manager that finds the drafting row and, for an owner's draft, its sources. */
const drafting = (row: PublicDocumentEntity, sources: ReadonlyArray<PublicDocumentSourceEntity> = []) =>
    fakeTransaction(mockEntityManager(publicDraftingAnswers(row, sources)))

const stopped = (code: string, status = "failed") => [
    PublicDocumentEntity,
    { id: "d1", workspaceId: WS, status: "drafting", draftRevision: 0 },
    { status, failureCode: code },
]

describe("PublicDraftRunService an owner's draft from the public area", () => {
    it("shows the public documents to the one call and writes its text, with nothing left out", async () => {
        const tx = drafting(rowOf(), [sourceRow("s1"), sourceRow("s2")])
        const { run, reader, writer } = await build(tx.em, [docOf("s1", REPAIR), docOf("s2", "Wheel truing in one day.")])
        writer.write.mockResolvedValue({ answers: true, body: ` ${REPAIRED} ` })

        await expect(run.generate(payload)).resolves.toBe("done")

        expect(writer.write).toHaveBeenCalledTimes(1)
        expect(writer.write).toHaveBeenCalledWith({
            workspaceId: WS,
            title: "Frequent questions",
            question: null,
            instructions: "Keep it short",
            sources: [
                { sourceId: "s1", title: "Document s1", text: REPAIR, cut: false },
                { sourceId: "s2", title: "Document s2", text: "Wheel truing in one day.", cut: false },
            ],
        })
        expect(tx.em.update).toHaveBeenCalledWith(
            PublicDocumentEntity,
            { id: "d1", workspaceId: WS, status: "drafting", draftRevision: 0 },
            { body: REPAIRED, leftOut: [], status: "draft", failureCode: null, draftRevision: 1 },
        )
        expect(tx.em.update).toHaveBeenCalledWith(
            PublicDocumentSourceEntity,
            { documentId: "d1", sourceId: "s2" },
            { sourceTitle: "Document s2", contentHash: "h-s2" },
        )
        // A public document needs no internal right: nothing goes through the internal reader.
        expect(reader.read).not.toHaveBeenCalled()
    })

    it("returns a published document to published, with its approved text still live", async () => {
        const tx = drafting(rowOf({ publishedBody: "in use" }), [sourceRow("s1")])
        const { run, writer } = await build(tx.em, [docOf("s1", REPAIR)])
        writer.write.mockResolvedValue({ answers: true, body: REPAIRED })

        await run.generate(payload)

        expect(tx.em.update).toHaveBeenCalledWith(
            PublicDocumentEntity,
            { id: "d1", workspaceId: WS, status: "drafting", draftRevision: 0 },
            expect.objectContaining({ status: "published" }),
        )
    })

    it("shows each source only its share of the call's bound and logs the cut", async () => {
        const tx = drafting(rowOf(), [sourceRow("s1"), sourceRow("s2")])
        const long = `${"spoke ".repeat(MAX_SHOWN_CHARS / 4)}`
        const { run, writer, logger } = await build(tx.em, [docOf("s1", long), docOf("s2", REPAIR)])
        writer.write.mockResolvedValue({ answers: true, body: REPAIRED })

        await run.generate(payload)

        const [brief] = writer.write.mock.calls[0] ?? []
        expect(brief?.sources[0]?.cut).toBe(true)
        expect(brief?.sources[0]?.text.length).toBeLessThanOrEqual(MAX_SHOWN_CHARS / 2)
        expect(brief?.sources[1]).toEqual({ sourceId: "s2", title: "Document s2", text: REPAIR, cut: false })
        expect(logger.warn).toHaveBeenCalledWith("public_documents.draft.source_cut", { documentId: "d1", sourceId: "s1" })
    })
})

describe("PublicDraftRunService the area of an owner's draft", () => {
    it.each<readonly [string, string]>([
        ["is in the internal area", "internal"],
        ["has an area that cannot be read", ""],
        ["has an area of no known name", "partners"],
    ])("refuses a chosen source that %s, before any text is read or a model is called", async (_name, visibility) => {
        const tx = drafting(rowOf(), [sourceRow("s1"), sourceRow("s2")])
        const { run, sources, writer } = await build(tx.em, [docOf("s1", REPAIR), docOf("s2", "Staff rota", visibility)])

        await expect(run.generate(payload)).resolves.toBe("done")

        expect(tx.em.update.mock.calls).toEqual([stopped(codes.SourceInternal)])
        expect(sources.textOf).not.toHaveBeenCalled()
        expect(writer.write).not.toHaveBeenCalled()
    })

    it("never shows a source that moved to the internal area between the area check and its read", async () => {
        const tx = drafting(rowOf(), [sourceRow("s1")])
        const { run, sources, writer } = await build(tx.em, [docOf("s1", REPAIR)])
        sources.textOf.mockResolvedValue(docOf("s1", REPAIR, "internal"))

        await run.generate(payload)

        expect(tx.em.update.mock.calls).toEqual([stopped(codes.SourceNotReady)])
        expect(writer.write).not.toHaveBeenCalled()
    })

    it.each<readonly [string, ReadonlyArray<SourceDocument>]>([
        ["is gone", []],
        ["is not fully read", [brainDocumentOf({ status: "indexing" })]],
        ["has no hash yet", [brainDocumentOf({ contentHash: null })]],
    ])("stops without the model when a chosen source %s", async (_name, shelf) => {
        const tx = drafting(rowOf(), [sourceRow("s1")])
        const { run, writer } = await build(tx.em, shelf)

        await run.generate(payload)

        expect(tx.em.update.mock.calls).toEqual([stopped(codes.SourceNotReady)])
        expect(writer.write).not.toHaveBeenCalled()
    })

    it("keeps a published document published when its draft is refused", async () => {
        const tx = drafting(rowOf({ publishedBody: "in use" }), [sourceRow("s1")])
        const { run } = await build(tx.em, [docOf("s1", REPAIR, "internal")])

        await run.generate(payload)

        expect(tx.em.update).toHaveBeenCalledWith(...stopped(codes.SourceInternal, "published"))
    })
})

describe("PublicDraftRunService an owner's draft that stops", () => {
    it("stops when the model gave no readable answer, and writes nothing of the sources", async () => {
        const tx = drafting(rowOf(), [sourceRow("s1")])
        const { run, writer } = await build(tx.em, [docOf("s1", REPAIR)])
        writer.write.mockResolvedValue(null)

        await run.generate(payload)

        expect(tx.em.update.mock.calls).toEqual([stopped(codes.DraftUnavailable)])
        expect(tx.em.insert).not.toHaveBeenCalled()
    })

    it.each([
        { answers: false, body: "" },
        { answers: false, body: REPAIRED },
        { answers: true, body: "  " },
    ])("stops with nothing left when the model answers %j", async (answer) => {
        const tx = drafting(rowOf(), [sourceRow("s1")])
        const { run, writer } = await build(tx.em, [docOf("s1", REPAIR)])
        writer.write.mockResolvedValue(answer)

        await run.generate(payload)

        expect(tx.em.update.mock.calls).toEqual([stopped(codes.NothingLeft)])
    })

    it("stops without the model when the public documents hold no text", async () => {
        const tx = drafting(rowOf(), [sourceRow("s1")])
        const { run, writer } = await build(tx.em, [docOf("s1", " \n ")])

        await run.generate(payload)

        expect(tx.em.update.mock.calls).toEqual([stopped(codes.NothingLeft)])
        expect(writer.write).not.toHaveBeenCalled()
    })

    it("fails without the model when the workspace has no credits left", async () => {
        const tx = drafting(rowOf(), [sourceRow("s1")])
        const { run, usage, sources, writer } = await build(tx.em, [docOf("s1", REPAIR)])
        usage.blockedBy.mockResolvedValue(true)

        await run.generate(payload)

        expect(tx.em.update).toHaveBeenCalledWith(...stopped("blocked_credits"))
        expect(sources.statesOf).not.toHaveBeenCalled()
        expect(writer.write).not.toHaveBeenCalled()
    })
})

describe("PublicDraftRunService a job to leave alone", () => {
    it("skips a payload that is not a draft job", async () => {
        const { run } = await build(mockEntityManager())

        await expect(run.generate({ nothing: true })).resolves.toBe("skipped")
    })

    it.each([null, rowOf({ status: "draft" }), rowOf({ status: "published" })])("skips %j", async (row) => {
        const em = mockEntityManager({ findOne: [PublicDocumentEntity, row] })
        const { run, sources } = await build(em)

        await expect(run.generate(payload)).resolves.toBe("skipped")
        expect(sources.statesOf).not.toHaveBeenCalled()
    })
})

describe("PublicDraftRunService fail", () => {
    it("marks an owner's draft failed once the job gave up", async () => {
        const em = mockEntityManager({
            findOne: [PublicDocumentEntity, rowOf()],
            update: [PublicDocumentEntity, { affected: 1 }],
        })
        const { run } = await build(em)

        await run.fail(payload)

        expect(em.update).toHaveBeenCalledWith(...stopped(codes.DraftUnavailable))
    })

    it("drops a proposal the job gave up on, since nobody asked for it", async () => {
        const em = mockEntityManager({
            findOne: [PublicDocumentEntity, rowOf({ gapId: "g1" })],
            delete: [PublicDocumentEntity, { affected: 1 }],
        })
        const { run } = await build(em)

        await run.fail(payload)

        expect(em.delete).toHaveBeenCalledWith(PublicDocumentEntity, {
            id: "d1",
            workspaceId: WS,
            status: "drafting",
            draftRevision: 0,
        })
    })

    it("leaves a row that is not drafting, and a payload that is not a draft job", async () => {
        const em = mockEntityManager({ findOne: [PublicDocumentEntity, null] })
        const { run } = await build(em)

        await run.fail(payload)
        await run.fail({})

        expect(em.update).not.toHaveBeenCalled()
        expect(em.delete).not.toHaveBeenCalled()
    })
})

describe("PublicDraftRunService revision fence", () => {
    it("leaves a later redraft untouched by an older queued delivery", async () => {
        const em = mockEntityManager({ findOne: [PublicDocumentEntity, rowOf({ draftRevision: 1 })] })
        const { run, sources, writer } = await build(em)

        await expect(run.generate(payload)).resolves.toBe("skipped")

        expect(sources.statesOf).not.toHaveBeenCalled()
        expect(writer.write).not.toHaveBeenCalled()
        expect(em.update).not.toHaveBeenCalled()
    })

    it.each([0, undefined])(
        "does not rewrite provenance when a concurrent draft write affects %s rows",
        async (affected) => {
            const tx = drafting(rowOf(), [sourceRow("s1")])
            const { run, writer } = await build(tx.em, [docOf("s1", REPAIR)])
            writer.write.mockResolvedValue({ answers: true, body: REPAIRED })
            tx.em.update.mockResolvedValueOnce({
                ...(affected === undefined ? {} : { affected }),
                raw: [],
                generatedMaps: [],
            })

            await run.generate(payload)

            expect(tx.em.update).toHaveBeenCalledTimes(1)
            expect(tx.em.update).toHaveBeenCalledWith(
                PublicDocumentEntity,
                { id: "d1", workspaceId: WS, status: "drafting", draftRevision: 0 },
                expect.anything(),
            )
        },
    )
})
