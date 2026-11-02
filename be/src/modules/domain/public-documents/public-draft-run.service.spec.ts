import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { UsageMeterService } from "@modules/domain/knowledge"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import {
    WS,
    documentRow,
    documentSourceRow,
    publicDraftingAnswers,
} from "@tests/fixtures/builders/public-documents.builder"
import { PublicDocumentsErrorCode } from "./errors/public-documents.error"
import { InternalReaderService } from "./internal-reader.service"
import type { HitsOutcome, InternalDocumentReadOutcome } from "./internal-reader.service"
import { PublicDocumentEntity, PublicDocumentSourceEntity } from "./persistence/entities"
import { PublicDraftRunService } from "./public-draft-run.service"
import { PublicDraftWriterService } from "./public-draft-writer.service"

const codes = PublicDocumentsErrorCode
const payload = { documentId: "d1", workspaceId: WS, draftRevision: 0 }

/** A document NIVO is drafting for the owner, with a note and no text yet. */
const rowOf = (changes: Parameters<typeof documentRow>[0] = {}) =>
    documentRow({ status: "drafting", body: "", instructions: "Keep it short", ...changes })
const sourceRow = (sourceId: string) => documentSourceRow({ sourceId, sourceTitle: "old", contentHash: "old" })
const readOf = (sourceId: string, text: string): InternalDocumentReadOutcome => ({
    kind: "ok",
    text: { sourceId, title: `Document ${sourceId}`, contentHash: `h-${sourceId}`, text },
})

const build = async (em: MockEntityManager) => {
    const reader = mock<InternalReaderService>()
    const writer = mock<PublicDraftWriterService>()
    const usage = mock<UsageMeterService>()
    usage.blockedBy.mockResolvedValue(false)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PublicDraftRunService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: InternalReaderService, useValue: reader },
            { provide: PublicDraftWriterService, useValue: writer },
            { provide: UsageMeterService, useValue: usage },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { run: moduleRef.get(PublicDraftRunService), reader, writer, usage, logger }
}

/** A transaction over a manager that finds the drafting row and, for an owner's draft, its two sources. */
const drafting = (row: PublicDocumentEntity, sources: ReadonlyArray<PublicDocumentSourceEntity> = []) =>
    fakeTransaction(mockEntityManager(publicDraftingAnswers(row, sources)))

const stopped = (code: string, status = "failed") => [
    PublicDocumentEntity,
    { id: "d1", workspaceId: WS, status: "drafting", draftRevision: 0 },
    { status, failureCode: code },
]

describe("PublicDraftRunService an owner's draft", () => {
    it("reads each source, cuts the hard exclusions before the model and from what it wrote, and keeps what was left out", async () => {
        const tx = drafting(rowOf(), [sourceRow("s1"), sourceRow("s2")])
        const { run, reader, writer } = await build(tx.em)
        reader.read.mockImplementation((_ws, id) =>
            Promise.resolve(
                id === "s1"
                    ? readOf("s1", "Same day delivery.\nLuong nhan vien 9 trieu")
                    : readOf("s2", "Returns within 24 hours."),
            ),
        )
        writer.write.mockResolvedValue({ body: "Same day delivery.\nHop dong thue mat bang\nReturns within 24 hours." })

        await expect(run.generate(payload)).resolves.toBe("done")

        expect(reader.read).toHaveBeenCalledWith(WS, "s1")
        expect(writer.write).toHaveBeenCalledWith({
            workspaceId: WS,
            title: "Frequent questions",
            question: null,
            instructions: "Keep it short",
            sources: [
                { title: "Document s1", text: "Same day delivery." },
                { title: "Document s2", text: "Returns within 24 hours." },
            ],
        })
        expect(tx.em.update).toHaveBeenCalledWith(
            PublicDocumentEntity,
            { id: "d1", workspaceId: WS, status: "drafting", draftRevision: 0 },
            {
                body: "Same day delivery.\nReturns within 24 hours.",
                leftOut: [
                    { label: "Luong nhan vien 9 trieu", reason: "salary" },
                    { label: "Hop dong thue mat bang", reason: "contract" },
                ],
                status: "draft",
                failureCode: null,
                draftRevision: 1,
            },
        )
        expect(tx.em.update).toHaveBeenCalledWith(
            PublicDocumentSourceEntity,
            { documentId: "d1", sourceId: "s2" },
            { sourceTitle: "Document s2", contentHash: "h-s2" },
        )
    })
})

describe("PublicDraftRunService a draft of a published document", () => {
    it("returns a published document to published, with its approved text still live", async () => {
        const tx = drafting(rowOf({ publishedBody: "in use" }), [sourceRow("s1")])
        const { run, reader, writer } = await build(tx.em)
        reader.read.mockResolvedValue(readOf("s1", "Same day delivery."))
        writer.write.mockResolvedValue({ body: "Same day delivery." })

        await run.generate(payload)

        expect(tx.em.update).toHaveBeenCalledWith(
            PublicDocumentEntity,
            { id: "d1", workspaceId: WS, status: "drafting", draftRevision: 0 },
            expect.objectContaining({ status: "published" }),
        )
    })

    it.each<readonly [string, InternalDocumentReadOutcome, string]>([
        ["no agent may read the internal documents", { kind: "no_right" }, codes.NoInternalRight],
        ["a source the tool refuses", { kind: "refused" }, codes.SourceNotReady],
    ])("stops with a code when %s", async (_name, outcome, code) => {
        const tx = drafting(rowOf(), [sourceRow("s1")])
        const { run, reader, writer } = await build(tx.em)
        reader.read.mockResolvedValue(outcome)

        await run.generate(payload)

        expect(tx.em.update).toHaveBeenCalledWith(...stopped(code))
        expect(writer.write).not.toHaveBeenCalled()
    })

    it("stops when every line of every source hit a hard exclusion, without calling the model", async () => {
        const tx = drafting(rowOf(), [sourceRow("s1")])
        const { run, reader, writer } = await build(tx.em)
        reader.read.mockResolvedValue(readOf("s1", "Luong nhan vien\nHop dong A"))

        await run.generate(payload)

        expect(tx.em.update).toHaveBeenCalledWith(...stopped(codes.NothingLeft))
        expect(writer.write).not.toHaveBeenCalled()
    })
})

describe("PublicDraftRunService an owner's draft that stops", () => {
    it("stops when the model is unavailable", async () => {
        const tx = drafting(rowOf(), [sourceRow("s1")])
        const { run, reader, writer } = await build(tx.em)
        reader.read.mockResolvedValue(readOf("s1", "Same day delivery."))
        writer.write.mockResolvedValue(null)

        await run.generate(payload)

        expect(tx.em.update).toHaveBeenCalledWith(...stopped(codes.DraftUnavailable))
    })

    it("stops when everything the model wrote hits a hard exclusion", async () => {
        const tx = drafting(rowOf(), [sourceRow("s1")])
        const { run, reader, writer } = await build(tx.em)
        reader.read.mockResolvedValue(readOf("s1", "Same day delivery."))
        writer.write.mockResolvedValue({ body: "Von dieu le 300 trieu" })

        await run.generate(payload)

        expect(tx.em.update).toHaveBeenCalledWith(...stopped(codes.NothingLeft))
    })

    it("stops a never-approved document as failed and keeps a published one published when it stops", async () => {
        const tx = drafting(rowOf({ publishedBody: "in use" }), [sourceRow("s1")])
        const { run, reader } = await build(tx.em)
        reader.read.mockResolvedValue({ kind: "no_right" })

        await run.generate(payload)

        expect(tx.em.update).toHaveBeenCalledWith(...stopped(codes.NoInternalRight, "published"))
    })

    it("fails without the model when the workspace has no credits left", async () => {
        const tx = drafting(rowOf(), [sourceRow("s1")])
        const { run, usage, reader } = await build(tx.em)
        usage.blockedBy.mockResolvedValue(true)

        await run.generate(payload)

        expect(tx.em.update).toHaveBeenCalledWith(...stopped("blocked_credits"))
        expect(reader.read).not.toHaveBeenCalled()
    })
})

describe("PublicDraftRunService a job to leave alone", () => {
    it("skips a payload that is not a draft job", async () => {
        const { run } = await build(mockEntityManager())

        await expect(run.generate({ nothing: true })).resolves.toBe("skipped")
    })

    it.each([null, rowOf({ status: "draft" }), rowOf({ status: "published" })])("skips %j", async (row) => {
        const em = mockEntityManager({ findOne: [PublicDocumentEntity, row] })
        const { run, reader } = await build(em)

        await expect(run.generate(payload)).resolves.toBe("skipped")
        expect(reader.read).not.toHaveBeenCalled()
    })
})

const question = "Cua hang co giao trong toi nay khong?"
const proposal = rowOf({ kind: "answer", gapId: "g1", question, title: question, instructions: null })
const hits = (...ids: Array<string>): HitsOutcome => ({ kind: "ok", sourceIds: ids })

describe("PublicDraftRunService the answer to a customer question", () => {
    it("proposes the text written from the internal documents that cover the question", async () => {
        const tx = drafting(proposal)
        const { run, reader, writer } = await build(tx.em)
        reader.hits.mockResolvedValue(hits("s1", "s2"))
        reader.read.mockImplementation((_ws, id) =>
            Promise.resolve(
                id === "s1"
                    ? readOf("s1", "Cua hang giao trong toi nay den 21h.\nLuong giao hang 5 trieu")
                    : readOf("s2", "Chinh sach doi tra hoa tuoi."),
            ),
        )
        writer.write.mockResolvedValue({ body: "We deliver until 9 pm tonight." })

        await expect(run.generate(payload)).resolves.toBe("done")

        expect(reader.hits).toHaveBeenCalledWith(WS, question)
        expect(writer.write).toHaveBeenCalledWith({
            workspaceId: WS,
            title: question,
            question,
            instructions: null,
            sources: [{ title: "Document s1", text: "Cua hang giao trong toi nay den 21h." }],
        })
        expect(tx.em.insert).toHaveBeenCalledWith(PublicDocumentSourceEntity, [
            { documentId: "d1", sourceId: "s1", workspaceId: WS, sourceTitle: "Document s1", contentHash: "h-s1" },
        ])
        expect(tx.em.update).toHaveBeenCalledWith(
            PublicDocumentEntity,
            { id: "d1", workspaceId: WS, status: "drafting", draftRevision: 0 },
            {
                title: question,
                body: "We deliver until 9 pm tonight.",
                leftOut: [{ label: "Luong giao hang 5 trieu", reason: "salary" }],
                status: "draft",
                failureCode: null,
                draftRevision: 1,
            },
        )
        expect(tx.em.delete.mock.calls).toEqual([[PublicDocumentSourceEntity, { documentId: "d1", workspaceId: WS }]])
        expect(tx.em.delete.mock.calls.map(([entity]) => entity)).not.toContain(PublicDocumentEntity)
    })

    it.each<readonly [string, HitsOutcome]>([
        ["no agent may search the internal documents", { kind: "no_right" }],
        ["the search was refused", { kind: "refused" }],
        ["the search found no document", hits()],
    ])("drops the proposal when %s", async (_name, outcome) => {
        const tx = drafting(proposal)
        const { run, reader, writer, logger } = await build(tx.em)
        reader.hits.mockResolvedValue(outcome)

        await run.generate(payload)

        expect(tx.em.delete).toHaveBeenCalledWith(PublicDocumentEntity, {
            id: "d1",
            workspaceId: WS,
            status: "drafting",
            draftRevision: 0,
        })
        expect(writer.write).not.toHaveBeenCalled()
        expect(logger.info).toHaveBeenCalledWith("public_documents.proposal.skipped", expect.anything())
    })
})

describe("PublicDraftRunService a proposal that is dropped", () => {
    it("drops the proposal when the documents found do not cover the question, or are public, or are all hard exclusions", async () => {
        const tx = drafting(proposal)
        const { run, reader, writer } = await build(tx.em)
        reader.hits.mockResolvedValue(hits("s1", "s2", "s3"))
        reader.read.mockImplementation((_ws, id) => {
            if (id === "s1") return Promise.resolve(readOf("s1", "Chinh sach doi tra hoa tuoi."))
            if (id === "s2") return Promise.resolve<InternalDocumentReadOutcome>({ kind: "refused" })
            return Promise.resolve(readOf("s3", "Luong giao hang toi nay"))
        })

        await run.generate(payload)

        expect(tx.em.delete).toHaveBeenCalled()
        expect(writer.write).not.toHaveBeenCalled()
    })

    it.each([null, "Approved answer"])(
        "does not replace working provenance when the model gives nothing or only a hard exclusion; published=%s",
        async (publishedBody) => {
            const tx = drafting({ ...proposal, publishedBody })
            const { run, reader, writer } = await build(tx.em)
            reader.hits.mockResolvedValue(hits("s1"))
            reader.read.mockResolvedValue(readOf("s1", "Cua hang giao trong toi nay den 21h."))

            writer.write.mockResolvedValueOnce(null)
            await run.generate(payload)
            writer.write.mockResolvedValueOnce({ body: "Hop dong giao hang" })
            await run.generate(payload)

            expect(tx.em.delete).toHaveBeenCalledTimes(publishedBody === null ? 2 : 0)
            expect(tx.em.insert).not.toHaveBeenCalled()
        },
    )

    it("falls back to the title when the proposal has no question text", async () => {
        const tx = drafting(rowOf({ gapId: "g1", question: null, title: question }))
        const { run, reader } = await build(tx.em)
        reader.hits.mockResolvedValue(hits())

        await run.generate(payload)

        expect(reader.hits).toHaveBeenCalledWith(WS, question)
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
        const { run, reader, writer } = await build(em)

        await expect(run.generate(payload)).resolves.toBe("skipped")

        expect(reader.read).not.toHaveBeenCalled()
        expect(writer.write).not.toHaveBeenCalled()
        expect(em.update).not.toHaveBeenCalled()
    })

    it.each([0, undefined])(
        "does not rewrite provenance when a concurrent draft write affects %s rows",
        async (affected) => {
            const tx = drafting(rowOf(), [sourceRow("s1")])
            const { run, reader, writer } = await build(tx.em)
            reader.read.mockResolvedValue(readOf("s1", "Same day delivery."))
            writer.write.mockResolvedValue({ body: "Same day delivery." })
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

describe("PublicDraftRunService a published answer redraft", () => {
    it("retains the approved owner row and public snapshot when its internal answer can no longer be read", async () => {
        const tx = drafting(
            rowOf({ kind: "answer", gapId: "g1", question, publishedBody: "Approved answer", publishedRevision: 0 }),
        )
        const { run, reader } = await build(tx.em)
        reader.hits.mockResolvedValue({ kind: "no_right" })

        await run.generate(payload)

        expect(tx.em.delete).not.toHaveBeenCalled()
        expect(tx.em.update).toHaveBeenCalledWith(...stopped(codes.NoInternalRight, "published"))
    })

    it("replaces the working provenance in the guarded transaction rather than inserting duplicate source keys", async () => {
        const tx = drafting(
            rowOf({ kind: "answer", gapId: "g1", question, publishedBody: "Approved answer", publishedRevision: 0 }),
            [sourceRow("s1")],
        )
        const { run, reader, writer } = await build(tx.em)
        reader.hits.mockResolvedValue(hits("s1"))
        reader.read.mockResolvedValue(readOf("s1", "Cua hang giao trong toi nay den 21h."))
        writer.write.mockResolvedValue({ body: "The team delivers before 9 pm." })

        await run.generate(payload)

        expect(tx.em.delete).toHaveBeenCalledWith(PublicDocumentSourceEntity, { documentId: "d1", workspaceId: WS })
        expect(tx.em.insert).toHaveBeenCalledWith(PublicDocumentSourceEntity, expect.anything())
        expect(tx.em.update).toHaveBeenCalledWith(
            PublicDocumentEntity,
            { id: "d1", workspaceId: WS, status: "drafting", draftRevision: 0 },
            expect.objectContaining({ status: "published", draftRevision: 1 }),
        )
        expect(tx.commits).toBe(1)
    })
})

describe("PublicDraftRunService concurrent answer jobs", () => {
    it.each([0, undefined])(
        "keeps answer evidence intact when the revision fence affects %s rows",
        async (affected) => {
            const tx = drafting(proposal)
            const { run, reader, writer } = await build(tx.em)
            reader.hits.mockResolvedValue(hits("s1"))
            reader.read.mockResolvedValue(readOf("s1", "Cua hang giao trong toi nay den 21h."))
            writer.write.mockResolvedValue({ body: "Delivery before 9 pm." })
            tx.em.update.mockResolvedValueOnce({
                ...(affected === undefined ? {} : { affected }),
                raw: [],
                generatedMaps: [],
            })
            await expect(run.generate(payload)).resolves.toBe("done")
            expect(tx.em.delete).not.toHaveBeenCalled()
            expect(tx.em.insert).not.toHaveBeenCalled()
            expect(tx.em.update).toHaveBeenCalledTimes(1)
        },
    )

    it.each([0, undefined])(
        "does not announce a skipped proposal when a concurrent delete affects %s rows",
        async (affected) => {
            const tx = drafting(proposal)
            const { run, reader, logger } = await build(tx.em)
            reader.hits.mockResolvedValue({ kind: "no_right" })
            tx.em.delete.mockResolvedValueOnce({ ...(affected === undefined ? {} : { affected }), raw: [] })
            await run.generate(payload)
            expect(tx.em.delete).toHaveBeenCalledWith(PublicDocumentEntity, {
                id: "d1",
                workspaceId: WS,
                status: "drafting",
                draftRevision: 0,
            })
            expect(logger.info).not.toHaveBeenCalled()
        },
    )
})
