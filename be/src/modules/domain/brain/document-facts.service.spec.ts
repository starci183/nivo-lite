import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { DOC_AT, DOC_CONTENT, DOC_SOURCE, DOC_WS, docSourceOf } from "@tests/fixtures/builders/document-facts.builder"
import { BrainExtractionsService, ExtractionNote } from "@modules/domain/brain-extractions"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { passageTextHashOf } from "@modules/domain/knowledge-chunks"
import { DOC_ANSWERS, KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { KnowledgeIndexingService, UsageMeterService } from "@modules/domain/knowledge"
import { KnowledgeSourcesService, StoredNote } from "@modules/domain/knowledge-sources"
import { AI } from "@modules/integrations/ai"
import type { AiService } from "@modules/integrations/ai"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BrainLogEvent } from "./brain.log-events"
import { DocumentFactsService } from "./document-facts.service"
import { BrainErrorCode } from "./errors/brain.error"
import { MAX_FACTS_PER_DOC, PROMPT_VERSION, SYSTEM_PROMPT } from "./extraction.policy"
import { DocumentReviewService } from "./document-review.service"
import { ModelJsonService } from "./model-json.service"

const WS = DOC_WS
const SOURCE = DOC_SOURCE
const AT = DOC_AT
const CONTENT = DOC_CONTENT
const HASH = "81a3438226c4b1fe964fb95e85cdfe3a"
const PAYLOAD = { workspaceId: WS, sourceId: SOURCE }
const PROMPT = `Document: "Hours"\nUpdated: 2026-10-12\nPart 1 of 1\nEXCERPT:\n<<<\n${CONTENT}\n>>>`
const USAGE = { promptTokens: 10, completionTokens: 20, totalTokens: 30, costUsd: 0.001 }
const REPLY = { text: "answer", model: "m1", usage: USAGE, parsed: null, retrieved: 0 }

const sourceOf = docSourceOf
type ExtractionRecord = NonNullable<Awaited<ReturnType<BrainExtractionsService["get"]>>>

const extractionOf = builder<ExtractionRecord>({
    sourceId: SOURCE,
    status: "running",
    factsProposed: 0,
    promptVersion: PROMPT_VERSION,
    contentHash: HASH,
    windowsTotal: 1,
    windowsDone: 0,
    attempts: 0,
    orphanFactIds: [],
    passageHashes: [],
    factsChanged: false,
})

type Progress = Parameters<BrainExtractionsService["save"]>[2]

const startOf = builder<Parameters<BrainExtractionsService["start"]>[0]>({
    workspaceId: WS,
    sourceId: SOURCE,
    promptVersion: 1,
    contentHash: HASH,
    windowsTotal: 1,
    orphanFactIds: [],
    factsChanged: false,
})

const progressOf = builder<Progress>({
    status: "running",
    windowsDone: 0,
    factsProposed: 0,
    windowsTotal: 1,
    error: null,
    attempts: 0,
})

const build = async (source = sourceOf()) => {
    const ai = mock<AiService>()
    const logger = mock<Logger>()
    const facts = mock<BrainFactsService>()
    const gaps = mock<KnowledgeGapsService>()
    const extractions = mock<BrainExtractionsService>()
    const indexing = mock<KnowledgeIndexingService>()
    const sources = mock<KnowledgeSourcesService>()
    const usage = mock<UsageMeterService>()
    const json = mock<ModelJsonService>()
    const reviews = mock<DocumentReviewService>()
    indexing.sourceForFacts.mockResolvedValue(source)
    extractions.get.mockResolvedValue(extractionOf())
    usage.blockedBy.mockResolvedValue(false)
    ai.chat.mockResolvedValue(REPLY)
    json.jsonOf.mockReturnValue({ facts: [] })
    const moduleRef = await Test.createTestingModule({
        providers: [
            DocumentFactsService,
            { provide: AI, useValue: ai },
            { provide: LOGGER, useValue: logger },
            { provide: BrainFactsService, useValue: facts },
            { provide: KnowledgeGapsService, useValue: gaps },
            { provide: BrainExtractionsService, useValue: extractions },
            { provide: KnowledgeIndexingService, useValue: indexing },
            { provide: KnowledgeSourcesService, useValue: sources },
            { provide: UsageMeterService, useValue: usage },
            { provide: ModelJsonService, useValue: json },
            { provide: DocumentReviewService, useValue: reviews },
        ],
    }).compile()
    const service = moduleRef.get(DocumentFactsService)
    return { service, ai, logger, facts, gaps, extractions, indexing, sources, usage, json, reviews }
}

describe("DocumentFactsService", () => {
    it("drops a malformed job payload and skips a source no longer waiting for facts", async () => {
        const { service, logger, indexing, extractions } = await build()

        await expect(service.run({ sourceId: SOURCE })).resolves.toBe("skipped")
        expect(logger.warn).toHaveBeenCalledWith(BrainLogEvent.PayloadRefused, { job: "facts" })
        expect(indexing.sourceForFacts).not.toHaveBeenCalled()
        indexing.sourceForFacts.mockResolvedValue(null)

        await expect(service.run(PAYLOAD)).resolves.toBe("skipped")
        expect(indexing.sourceForFacts).toHaveBeenCalledWith(WS, SOURCE)
        expect(extractions.get).not.toHaveBeenCalled()
    })

    it("marks an exhausted valid job ready with an unread-facts note", async () => {
        const { service, sources, extractions, reviews } = await build()

        await service.giveUp({})
        expect(sources.ready).not.toHaveBeenCalled()
        expect(extractions.fail).not.toHaveBeenCalled()
        expect(reviews.requestForSource).not.toHaveBeenCalled()
        await service.giveUp(PAYLOAD)
        expect(reviews.requestForSource).toHaveBeenCalledWith(WS, SOURCE)
        expect(extractions.fail).toHaveBeenCalledWith(WS, SOURCE, ExtractionNote.Aborted)
        expect(sources.ready).toHaveBeenCalledWith(WS, SOURCE, StoredNote.FactsUnread)
    })

    it("withdraws a deleted source and finalizes its unsupported facts with the deletion evidence", async () => {
        const { service, facts, reviews } = await build()
        facts.withdrawSource.mockResolvedValue(["f1"])

        await service.withdraw(WS, SOURCE, "Menu")

        expect(reviews.requestForGoneSource).toHaveBeenCalledWith(WS, SOURCE, "Menu")
        expect(facts.withdrawSource).toHaveBeenCalledWith(WS, SOURCE, "source changed")
        expect(facts.finalizeOrphans).toHaveBeenCalledWith(WS, ["f1"], {
            kind: "note",
            ref: `gone:${SOURCE}`,
            label: 'The document "Menu" was deleted: no source supports this value any more',
        })
    })

    it("logs a failed withdrawal while allowing deletion to complete", async () => {
        const { service, facts, logger } = await build()
        const cause = new Error("withdraw failed")
        facts.withdrawSource.mockRejectedValue(cause)

        await expect(service.withdraw(WS, SOURCE, "Menu")).resolves.toBeUndefined()

        expect(logger.error).toHaveBeenCalledWith(BrainLogEvent.WithdrawFailed, cause, { sourceId: SOURCE })
        expect(facts.finalizeOrphans).not.toHaveBeenCalled()
    })

    it("does not read a document already completed with this text and prompt", async () => {
        const { service, extractions, sources, ai, reviews } = await build()
        extractions.get.mockResolvedValue(extractionOf({ status: "done" }))

        await expect(service.run(PAYLOAD)).resolves.toBe("skipped")

        expect(reviews.requestForSource).not.toHaveBeenCalled()
        expect(sources.settle).toHaveBeenCalledWith(WS, SOURCE, CONTENT)
        expect(extractions.start).not.toHaveBeenCalled()
        expect(ai.chat).not.toHaveBeenCalled()
    })
})
describe("DocumentFactsService", () => {
    it("starts a new extraction without withdrawing and defaults a missing resumed record", async () => {
        const { service, extractions, facts, usage, sources, ai } = await build()
        extractions.get.mockResolvedValue(null)
        usage.blockedBy.mockResolvedValue(true)

        await expect(service.run(PAYLOAD)).resolves.toBe("blocked")

        expect(extractions.start).toHaveBeenCalledWith(startOf({ orphanFactIds: [], factsChanged: false }))
        expect(facts.withdrawSource).not.toHaveBeenCalled()
        expect(extractions.save).toHaveBeenCalledWith(WS, SOURCE, progressOf({ status: "blocked_credits" }))
        expect(usage.blockedBy).toHaveBeenCalledWith(WS, "brain", false)
        expect(sources.blockFacts).toHaveBeenCalledWith(WS, SOURCE, StoredNote.NoCreditsForFacts)
        expect(ai.chat).not.toHaveBeenCalled()
    })

    it("restarts changed text, merging old and newly orphaned facts once", async () => {
        const { service, extractions, facts, usage } = await build()
        extractions.get.mockResolvedValueOnce(extractionOf({ contentHash: "old", orphanFactIds: ["f1", "f2"] }))
        extractions.get.mockResolvedValueOnce(
            extractionOf({ attempts: 2, factsProposed: 3, orphanFactIds: ["f1", "f2", "f3"] }),
        )
        facts.withdrawChanged.mockResolvedValue({ orphans: ["f2", "f3"], withdrawn: 2 })
        usage.blockedBy.mockResolvedValue(true)

        await expect(service.run(PAYLOAD)).resolves.toBe("blocked")

        expect(facts.withdrawChanged).toHaveBeenCalledWith(WS, SOURCE, "source changed", "")
        expect(extractions.start).toHaveBeenCalledWith(
            startOf({ orphanFactIds: ["f1", "f2", "f3"], factsChanged: true }),
        )
        expect(extractions.save).toHaveBeenCalledWith(
            WS,
            SOURCE,
            progressOf({ status: "blocked_credits", factsProposed: 3, attempts: 2 }),
        )
    })
})
describe("DocumentFactsService", () => {
    it("restarts the same text when the prompt version changed", async () => {
        const { service, extractions, facts, reviews } = await build()
        extractions.get.mockResolvedValueOnce(extractionOf({ promptVersion: 0 }))
        extractions.get.mockResolvedValueOnce(extractionOf({ windowsDone: 1, orphanFactIds: ["f1"] }))
        facts.withdrawChanged.mockResolvedValue({ orphans: [], withdrawn: 0 })

        await expect(service.run(PAYLOAD)).resolves.toBe("done")

        expect(extractions.start).toHaveBeenCalledWith(startOf({ orphanFactIds: [], factsChanged: false }))
        expect(facts.finalizeOrphans).toHaveBeenCalledWith(WS, ["f1"], {
            kind: "note",
            ref: `gone:${SOURCE}`,
            label: 'The document "Hours" changed: no source supports this value any more',
        })
        expect(extractions.finish).toHaveBeenCalledWith(WS, SOURCE, "", expect.anything())
        expect(reviews.requestForSource).toHaveBeenCalledWith(WS, SOURCE)
    })

    it("finishes an internal document already at its fact limit without resolving customer gaps", async () => {
        const { service, extractions, gaps, sources, usage } = await build(sourceOf({ visibility: "internal" }))
        extractions.get.mockResolvedValue(extractionOf({ factsProposed: MAX_FACTS_PER_DOC }))

        await expect(service.run(PAYLOAD)).resolves.toBe("done")

        expect(gaps.resolve).not.toHaveBeenCalled()
        expect(usage.blockedBy).not.toHaveBeenCalled()
        expect(sources.settle).toHaveBeenCalledWith(WS, SOURCE, CONTENT)
    })

    it("retries a busy model without charging usage", async () => {
        const { service, ai, usage, extractions, sources } = await build()
        ai.chat.mockResolvedValue(null)

        await expect(service.run(PAYLOAD)).rejects.toMatchObject({ code: BrainErrorCode.ModelUnavailable })

        const [request] = ai.chat.mock.calls[0] ?? []
        expect(request?.messages.map(({ role, content }) => `${role}:${content}`)).toEqual([
            `system:${SYSTEM_PROMPT}`,
            `user:${PROMPT}`,
        ])
        expect(request).toMatchObject({ json: false, timeoutMs: 40_000 })
        expect(usage.record).not.toHaveBeenCalled()
        expect(extractions.save).toHaveBeenCalledWith(
            WS,
            SOURCE,
            progressOf({ error: ExtractionNote.ModelBusy, attempts: 1 }),
        )
        expect(sources.ready).not.toHaveBeenCalled()
    })
})
describe("DocumentFactsService", () => {
    it.each([ExtractionNote.ModelBusy, ExtractionNote.AnswerUnreadable])(
        "closes the third %s attempt",
        async (note) => {
            const { service, ai, json, extractions, sources, reviews } = await build()
            if (note === ExtractionNote.ModelBusy) ai.chat.mockResolvedValue(null)
            else json.jsonOf.mockReturnValue({ other: [] })
            extractions.get.mockResolvedValue(extractionOf({ attempts: 2 }))

            await expect(service.run(PAYLOAD)).resolves.toBe("failed")

            expect(extractions.save).toHaveBeenCalledWith(
                WS,
                SOURCE,
                progressOf({ status: "failed", error: note, attempts: 3 }),
            )
            expect(sources.ready).toHaveBeenCalledWith(WS, SOURCE, StoredNote.FactsUnread)
            expect(reviews.requestForSource).toHaveBeenCalledWith(WS, SOURCE)
        },
    )

    it("charges an unreadable answer and retries with the unreadable note", async () => {
        const { service, json, usage, extractions } = await build()
        json.jsonOf.mockReturnValue(null)

        await expect(service.run(PAYLOAD)).rejects.toMatchObject({ code: BrainErrorCode.ModelUnavailable })

        expect(json.jsonOf).toHaveBeenCalledWith("answer")
        expect(usage.record).toHaveBeenCalledWith({
            workspaceId: WS,
            kind: "brain",
            module: "knowledge",
            model: "m1",
            usage: USAGE,
            promptChars: SYSTEM_PROMPT.length + PROMPT.length,
            completionChars: 6,
        })
        expect(extractions.save).toHaveBeenCalledWith(
            WS,
            SOURCE,
            progressOf({ error: ExtractionNote.AnswerUnreadable, attempts: 1 }),
        )
    })

    it.each([null, undefined, ""])("keeps the original result for a provider model %s", async (model) => {
        const { service, ai, extractions, sources } = await build(sourceOf({ content: `${"a".repeat(3500)}b` }))
        extractions.get.mockResolvedValue(null)
        const answer = Object.defineProperty({ ...REPLY }, "model", { value: model })
        ai.chat.mockResolvedValueOnce(REPLY).mockResolvedValueOnce(answer)
        await expect(service.run(PAYLOAD)).resolves.toBe("done")
        expect(ai.chat).toHaveBeenCalledTimes(2)
        expect(extractions.finish).toHaveBeenCalledWith(WS, SOURCE, model === "" ? "" : "m1", expect.anything())
        expect(sources.advance).toHaveBeenCalledWith(WS, SOURCE, { stage: "facts", done: 1, total: 2, progress: 92 })
        expect(sources.advance).toHaveBeenCalledWith(WS, SOURCE, { stage: "facts", done: 2, total: 2, progress: 99 })
    })
})
describe("DocumentFactsService", () => {
    it("files public facts with document evidence and preserves owner review and instance scope", async () => {
        const { service, json, facts, extractions, gaps, sources } = await build()
        extractions.get.mockResolvedValue(extractionOf({ attempts: 2 }))
        json.jsonOf.mockReturnValue({
            facts: [
                {
                    subjectType: "business",
                    subjectLabel: "Shop",
                    attributeLabel: "Hours",
                    value: "8am-9pm",
                    unit: "hours",
                    validFrom: "2026-10-12",
                    scope: "public",
                    quote: "Hours 8am-9pm",
                },
            ],
        })

        await expect(service.run(PAYLOAD)).resolves.toBe("done")

        expect(facts.propose).toHaveBeenCalledWith(WS, {
            subjectType: "business",
            subjectLabel: "Shop",
            attributeLabel: "Hours",
            value: "8am-9pm",
            unit: "hours",
            scope: "public",
            sourceKind: "document",
            validFrom: "2026-10-11T17:00:00.000Z",
            autoApply: false,
            installationId: "i1",
            proposedBy: "Document: Hours",
            evidence: [
                {
                    kind: "document",
                    ref: SOURCE,
                    label: "Hours",
                    quote: "Hours 8am-9pm",
                    at: AT,
                    sourceId: SOURCE,
                    title: "Hours",
                },
            ],
        })
        expect(extractions.save).toHaveBeenCalledWith(WS, SOURCE, progressOf({ windowsDone: 1, factsProposed: 1 }))
        expect(extractions.finish).toHaveBeenCalledWith(WS, SOURCE, "m1", expect.anything())
        expect(gaps.resolve).toHaveBeenCalledWith(WS, {
            text: `Hours Open ${CONTENT}`,
            minimum: DOC_ANSWERS,
            module: "chatbot",
            by: `document:${SOURCE}`,
        })
        expect(sources.settle).toHaveBeenCalledWith(WS, SOURCE, CONTENT)
    })
})
describe("DocumentFactsService", () => {
    it.each([
        { visibility: "public", scope: "internal", filed: "public" },
        { visibility: "public", scope: "public", filed: "public" },
        { visibility: "internal", scope: "public", filed: undefined },
    ])("files a $scope fact from a $visibility document as $filed", async ({ visibility, scope, filed }) => {
        const { service, json, facts } = await build(sourceOf({ visibility, installationId: null }))
        json.jsonOf.mockReturnValue({
            facts: [{ subjectLabel: "Shop", attributeLabel: "Price", value: "20 USD", scope }],
        })

        await expect(service.run(PAYLOAD)).resolves.toBe("done")

        expect(facts.propose).toHaveBeenCalledWith(WS, {
            subjectType: "other",
            subjectLabel: "Shop",
            attributeLabel: "Price",
            value: "20 USD",
            unit: null,
            scope: filed,
            sourceKind: "document",
            validFrom: null,
            autoApply: false,
            installationId: null,
            proposedBy: "Document: Hours",
            evidence: [
                {
                    kind: "document",
                    ref: SOURCE,
                    label: "Hours",
                    quote: undefined,
                    at: AT,
                    sourceId: SOURCE,
                    title: "Hours",
                },
            ],
        })
    })

    it("continues filing after a rejected fact and counts only successful proposals", async () => {
        const { service, json, facts, extractions, logger } = await build()
        const cause = new Error("first fact")
        facts.propose.mockRejectedValueOnce(cause)
        json.jsonOf.mockReturnValue({
            facts: [
                { subjectLabel: "Shop", attributeLabel: "Hours", value: "8am-9pm" },
                { subjectLabel: "Shop", attributeLabel: "Price", value: "20 USD" },
            ],
        })

        await expect(service.run(PAYLOAD)).resolves.toBe("done")

        expect(facts.propose).toHaveBeenCalledTimes(2)
        expect(logger.error).toHaveBeenCalledWith(BrainLogEvent.FilingFailed, cause, { sourceId: SOURCE })
        expect(extractions.save).toHaveBeenCalledWith(WS, SOURCE, progressOf({ windowsDone: 1, factsProposed: 1 }))
    })
})
describe("DocumentFactsService", () => {
    it("files only the room left under the document limit", async () => {
        const { service, json, facts, extractions } = await build()
        extractions.get.mockResolvedValue(extractionOf({ factsProposed: 199 }))
        json.jsonOf.mockReturnValue({
            facts: [
                { subjectLabel: "Shop", attributeLabel: "Hours", value: "8am-9pm" },
                { subjectLabel: "Shop", attributeLabel: "Price", value: "20 USD" },
            ],
        })

        await expect(service.run(PAYLOAD)).resolves.toBe("done")

        expect(facts.propose).toHaveBeenCalledTimes(1)
        expect(extractions.save).toHaveBeenCalledWith(WS, SOURCE, progressOf({ windowsDone: 1, factsProposed: 200 }))
    })

    it("finishes public text without a topic even when answering its gaps fails", async () => {
        const { service, gaps, logger, sources, extractions } = await build(sourceOf({ topic: null, module: null }))
        const cause = new Error("gaps")
        gaps.resolve.mockRejectedValue(cause)

        await expect(service.run(PAYLOAD)).resolves.toBe("done")

        expect(gaps.resolve).toHaveBeenCalledWith(WS, {
            text: `Hours  ${CONTENT}`,
            minimum: DOC_ANSWERS,
            module: null,
            by: `document:${SOURCE}`,
        })
        expect(logger.error).toHaveBeenCalledWith(BrainLogEvent.GapsFailed, cause, { sourceId: SOURCE })
        expect(sources.settle).toHaveBeenCalledWith(WS, SOURCE, CONTENT)
        extractions.get.mockResolvedValue(extractionOf({ windowsDone: -1 }))
        await expect(service.run(PAYLOAD)).resolves.toBe("done")
    })
})

describe("DocumentFactsService an edited document", () => {
    const read = [passageTextHashOf("## Hours\nOpen 8.")]
    it.each<["done" | "failed", boolean, number, number, boolean]>([
        ["done", false, 0, 0, false],
        ["done", false, 1, 0, true],
        ["done", true, 0, 1, true],
        ["failed", true, 0, 0, true],
    ])(
        "from a %s reading (changed %s, withdrew %i, filed %i): review %s",
        async (status, was, withdrawn, filed, reviewed) => {
            const { service, ai, extractions, facts, reviews } = await build(
                sourceOf({ content: "## Hours\nOpen 8.\n## Fees\nNew." }),
            )
            extractions.get.mockResolvedValueOnce(
                extractionOf({ contentHash: "old", status, factsChanged: was, passageHashes: read }),
            )
            extractions.get.mockResolvedValueOnce(
                extractionOf({ factsChanged: withdrawn > 0 || was, factsProposed: filed, passageHashes: read }),
            )
            facts.withdrawChanged.mockResolvedValue({ orphans: [], withdrawn })
            await expect(service.run(PAYLOAD)).resolves.toBe("done")
            expect(facts.withdrawChanged).toHaveBeenCalledWith(WS, SOURCE, "source changed", "## Hours\nOpen 8.")
            expect(ai.chat.mock.calls[0]?.[0].messages[1]?.content).not.toContain("Open 8.")
            expect(reviews.requestForSource).toHaveBeenCalledTimes(reviewed ? 1 : 0)
        },
    )
})
