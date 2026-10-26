import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { BrainExtractionsService, ExtractionNote } from "@modules/domain/brain-extractions"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { DOC_ANSWERS, KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { KnowledgeIndexingService, UsageMeterService } from "@modules/domain/knowledge"
import type { SourceRecord } from "@modules/domain/knowledge-sources"
import { KnowledgeSourcesService, StoredNote } from "@modules/domain/knowledge-sources"
import { LLM } from "@modules/integrations/llm"
import type { LlmPort } from "@modules/integrations/llm"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BrainLogEvent } from "./brain.log-events"
import { DocumentFactsService } from "./document-facts.service"
import { BrainErrorCode } from "./errors/brain.error"
import { MAX_FACTS_PER_DOC, PROMPT_VERSION, SYSTEM_PROMPT } from "./extraction.policy"
import { ModelJsonService } from "./model-json.service"

const WS = "11111111-1111-4111-8111-111111111111"
const SOURCE = "22222222-2222-4222-8222-222222222222"
const AT = "2026-10-12T10:00:00.000Z"
const CONTENT = "Hours 8am-9pm. Price 20 USD."
const HASH = "81a3438226c4b1fe964fb95e85cdfe3a"
const PAYLOAD = { workspaceId: WS, sourceId: SOURCE }
const PROMPT = `Document: "Hours"\nUpdated: 2026-10-12\nPart 1 of 1\nEXCERPT:\n<<<\n${CONTENT}\n>>>`
const USAGE = { promptTokens: 10, completionTokens: 20, totalTokens: 30, costUsd: 0.001 }

const sourceOf = builder<SourceRecord>({
    id: SOURCE,
    workspaceId: WS,
    module: "chatbot",
    installationId: "i1",
    kind: "text",
    topic: "Open",
    visibility: "public",
    title: "Hours",
    content: CONTENT,
    status: "extracting_facts",
    storagePath: null,
    sourceUrl: null,
    createdBy: "u1",
    updatedAt: AT,
})
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
})

const build = async (source = sourceOf()) => {
    const llm = mock<LlmPort>()
    const logger = mock<Logger>()
    const facts = mock<BrainFactsService>()
    const gaps = mock<KnowledgeGapsService>()
    const extractions = mock<BrainExtractionsService>()
    const indexing = mock<KnowledgeIndexingService>()
    const sources = mock<KnowledgeSourcesService>()
    const usage = mock<UsageMeterService>()
    const json = mock<ModelJsonService>()
    indexing.sourceForFacts.mockResolvedValue(source)
    extractions.get.mockResolvedValue(extractionOf())
    usage.blockedBy.mockResolvedValue(false)
    llm.complete.mockResolvedValue({ text: "answer", model: "m1", usage: USAGE })
    json.jsonOf.mockReturnValue({ facts: [] })
    const moduleRef = await Test.createTestingModule({
        providers: [
            DocumentFactsService,
            { provide: LLM, useValue: llm },
            { provide: LOGGER, useValue: logger },
            { provide: BrainFactsService, useValue: facts },
            { provide: KnowledgeGapsService, useValue: gaps },
            { provide: BrainExtractionsService, useValue: extractions },
            { provide: KnowledgeIndexingService, useValue: indexing },
            { provide: KnowledgeSourcesService, useValue: sources },
            { provide: UsageMeterService, useValue: usage },
            { provide: ModelJsonService, useValue: json },
        ],
    }).compile()
    const service = moduleRef.get(DocumentFactsService)
    return { service, llm, logger, facts, gaps, extractions, indexing, sources, usage, json }
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
        const { service, sources, extractions } = await build()

        await service.giveUp({})
        expect(sources.ready).not.toHaveBeenCalled()
        expect(extractions.fail).not.toHaveBeenCalled()
        await service.giveUp(PAYLOAD)
        expect(extractions.fail).toHaveBeenCalledWith(WS, SOURCE, ExtractionNote.Aborted)
        expect(sources.ready).toHaveBeenCalledWith(WS, SOURCE, StoredNote.FactsUnread)
    })

    it("withdraws a deleted source and finalizes its unsupported facts with the deletion evidence", async () => {
        const { service, facts } = await build()
        facts.withdrawSource.mockResolvedValue(["f1"])

        await service.withdraw(WS, SOURCE, "Menu")

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
        const { service, extractions, sources, llm } = await build()
        extractions.get.mockResolvedValue(extractionOf({ status: "done" }))

        await expect(service.run(PAYLOAD)).resolves.toBe("skipped")

        expect(sources.ready).toHaveBeenCalledWith(WS, SOURCE, null)
        expect(extractions.start).not.toHaveBeenCalled()
        expect(llm.complete).not.toHaveBeenCalled()
    })
})
describe("DocumentFactsService", () => {
    it("starts a new extraction without withdrawing and defaults a missing resumed record", async () => {
        const { service, extractions, facts, usage, sources, llm } = await build()
        extractions.get.mockResolvedValue(null)
        usage.blockedBy.mockResolvedValue(true)

        await expect(service.run(PAYLOAD)).resolves.toBe("blocked")

        expect(extractions.start).toHaveBeenCalledWith({
            workspaceId: WS,
            sourceId: SOURCE,
            promptVersion: 1,
            contentHash: HASH,
            windowsTotal: 1,
            orphanFactIds: [],
        })
        expect(facts.withdrawSource).not.toHaveBeenCalled()
        expect(extractions.save).toHaveBeenCalledWith(WS, SOURCE, {
            status: "blocked_credits",
            windowsDone: 0,
            factsProposed: 0,
            windowsTotal: 1,
            error: null,
            attempts: 0,
        })
        expect(usage.blockedBy).toHaveBeenCalledWith(WS, "brain", false)
        expect(sources.blockFacts).toHaveBeenCalledWith(WS, SOURCE, StoredNote.NoCreditsForFacts)
        expect(llm.complete).not.toHaveBeenCalled()
    })

    it("restarts changed text, merging old and newly orphaned facts once", async () => {
        const { service, extractions, facts, usage } = await build()
        extractions.get.mockResolvedValueOnce(extractionOf({ contentHash: "old", orphanFactIds: ["f1", "f2"] }))
        extractions.get.mockResolvedValueOnce(
            extractionOf({ attempts: 2, factsProposed: 3, orphanFactIds: ["f1", "f2", "f3"] }),
        )
        facts.withdrawSource.mockResolvedValue(["f2", "f3"])
        usage.blockedBy.mockResolvedValue(true)

        await expect(service.run(PAYLOAD)).resolves.toBe("blocked")

        expect(facts.withdrawSource).toHaveBeenCalledWith(WS, SOURCE, "source changed")
        expect(extractions.start).toHaveBeenCalledWith({
            workspaceId: WS,
            sourceId: SOURCE,
            promptVersion: 1,
            contentHash: HASH,
            windowsTotal: 1,
            orphanFactIds: ["f1", "f2", "f3"],
        })
        expect(extractions.save).toHaveBeenCalledWith(WS, SOURCE, {
            status: "blocked_credits",
            windowsDone: 0,
            factsProposed: 3,
            windowsTotal: 1,
            error: null,
            attempts: 2,
        })
    })
})
describe("DocumentFactsService", () => {
    it("restarts the same text when the prompt version changed", async () => {
        const { service, extractions, facts } = await build()
        extractions.get.mockResolvedValueOnce(extractionOf({ promptVersion: 0 }))
        extractions.get.mockResolvedValueOnce(extractionOf({ windowsDone: 1, orphanFactIds: ["f1"] }))
        facts.withdrawSource.mockResolvedValue([])

        await expect(service.run(PAYLOAD)).resolves.toBe("done")

        expect(extractions.start).toHaveBeenCalledWith({
            workspaceId: WS,
            sourceId: SOURCE,
            promptVersion: 1,
            contentHash: HASH,
            windowsTotal: 1,
            orphanFactIds: [],
        })
        expect(facts.finalizeOrphans).toHaveBeenCalledWith(WS, ["f1"], {
            kind: "note",
            ref: `gone:${SOURCE}`,
            label: 'The document "Hours" changed: no source supports this value any more',
        })
        expect(extractions.finish).toHaveBeenCalledWith(WS, SOURCE, "")
    })

    it("finishes an internal document already at its fact limit without resolving customer gaps", async () => {
        const { service, extractions, gaps, sources, usage } = await build(sourceOf({ visibility: "internal" }))
        extractions.get.mockResolvedValue(extractionOf({ factsProposed: MAX_FACTS_PER_DOC }))

        await expect(service.run(PAYLOAD)).resolves.toBe("done")

        expect(gaps.resolve).not.toHaveBeenCalled()
        expect(usage.blockedBy).not.toHaveBeenCalled()
        expect(sources.ready).toHaveBeenCalledWith(WS, SOURCE, null)
    })

    it("retries a busy model without charging usage", async () => {
        const { service, llm, usage, extractions, sources } = await build()
        llm.complete.mockResolvedValue(null)

        await expect(service.run(PAYLOAD)).rejects.toMatchObject({ code: BrainErrorCode.ModelUnavailable })

        expect(llm.complete).toHaveBeenCalledWith({ system: SYSTEM_PROMPT, prompt: PROMPT, timeoutMs: 40_000 })
        expect(usage.record).not.toHaveBeenCalled()
        expect(extractions.save).toHaveBeenCalledWith(WS, SOURCE, {
            status: "running",
            windowsDone: 0,
            factsProposed: 0,
            windowsTotal: 1,
            error: ExtractionNote.ModelBusy,
            attempts: 1,
        })
        expect(sources.ready).not.toHaveBeenCalled()
    })
})
describe("DocumentFactsService", () => {
    it.each([ExtractionNote.ModelBusy, ExtractionNote.AnswerUnreadable])(
        "closes the third %s attempt",
        async (note) => {
            const { service, llm, json, extractions, sources } = await build()
            if (note === ExtractionNote.ModelBusy) llm.complete.mockResolvedValue(null)
            else json.jsonOf.mockReturnValue({ other: [] })
            extractions.get.mockResolvedValue(extractionOf({ attempts: 2 }))

            await expect(service.run(PAYLOAD)).resolves.toBe("failed")

            expect(extractions.save).toHaveBeenCalledWith(WS, SOURCE, {
                status: "failed",
                windowsDone: 0,
                factsProposed: 0,
                windowsTotal: 1,
                error: note,
                attempts: 3,
            })
            expect(sources.ready).toHaveBeenCalledWith(WS, SOURCE, StoredNote.FactsUnread)
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
        expect(extractions.save).toHaveBeenCalledWith(WS, SOURCE, {
            status: "running",
            windowsDone: 0,
            factsProposed: 0,
            windowsTotal: 1,
            error: ExtractionNote.AnswerUnreadable,
            attempts: 1,
        })
    })

    it.each([null, undefined, ""])("keeps the original result for a provider model %s", async (model) => {
        const { service, llm, extractions } = await build(sourceOf({ content: `${"a".repeat(3500)}b` }))
        extractions.get.mockResolvedValue(null)
        const answer = { text: "answer", model: "m1", usage: USAGE }
        Object.defineProperty(answer, "model", { value: model })
        llm.complete.mockResolvedValueOnce({ text: "answer", model: "m1", usage: USAGE }).mockResolvedValueOnce(answer)
        await expect(service.run(PAYLOAD)).resolves.toBe("done")
        expect(llm.complete).toHaveBeenCalledTimes(2)
        expect(extractions.finish).toHaveBeenCalledWith(WS, SOURCE, model === "" ? "" : "m1")
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
        expect(extractions.save).toHaveBeenCalledWith(WS, SOURCE, {
            status: "running",
            windowsDone: 1,
            factsProposed: 1,
            windowsTotal: 1,
            error: null,
            attempts: 0,
        })
        expect(extractions.finish).toHaveBeenCalledWith(WS, SOURCE, "m1")
        expect(gaps.resolve).toHaveBeenCalledWith(WS, {
            text: `Hours Open ${CONTENT}`,
            minimum: DOC_ANSWERS,
            module: "chatbot",
            by: `document:${SOURCE}`,
        })
        expect(sources.ready).toHaveBeenCalledWith(WS, SOURCE, null)
    })
})
describe("DocumentFactsService", () => {
    it.each([
        { visibility: "public", scope: "internal" },
        { visibility: "internal", scope: "public" },
    ])("keeps the existing audience for $scope facts from a $visibility document", async ({ visibility, scope }) => {
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
            scope: undefined,
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
        expect(extractions.save).toHaveBeenCalledWith(WS, SOURCE, {
            status: "running",
            windowsDone: 1,
            factsProposed: 1,
            windowsTotal: 1,
            error: null,
            attempts: 0,
        })
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
        expect(extractions.save).toHaveBeenCalledWith(WS, SOURCE, {
            status: "running",
            windowsDone: 1,
            factsProposed: 200,
            windowsTotal: 1,
            error: null,
            attempts: 0,
        })
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
        expect(sources.ready).toHaveBeenCalledWith(WS, SOURCE, null)
        extractions.get.mockResolvedValue(extractionOf({ windowsDone: -1 }))
        await expect(service.run(PAYLOAD)).resolves.toBe("done")
    })
})
