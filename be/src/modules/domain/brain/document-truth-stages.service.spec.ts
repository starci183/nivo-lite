import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { DOC_SOURCE, DOC_WS } from "@tests/fixtures/builders/document-facts.builder"
import { BrainExtractionsService, ExtractionNote } from "@modules/domain/brain-extractions"
import { BrainFactsService, foldedText } from "@modules/domain/brain-facts"
import { KnowledgeChunksService } from "@modules/domain/knowledge-chunks"
import { UsageMeterService } from "@modules/domain/knowledge"
import { StoredNote } from "@modules/domain/knowledge-sources"
import { AI } from "@modules/integrations/ai"
import type { AiService } from "@modules/integrations/ai"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER, withWorkScope, workInScope } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DocumentTruthStagesService } from "./document-truth-stages.service"
import { TRUTHS_VERSION } from "./extraction.policy"
import { FactEmbeddingsService } from "./fact-embeddings.service"
import { INGESTION_TARGET } from "./ingestion-model.policy"
import { ModelJsonService } from "./model-json.service"
import { INHERITED_VERSION, tableKeyOf } from "./document-nature.policy"
import type { NatureInForce } from "./document-nature.policy"
import { DocumentNatureService } from "./document-nature.service"
import { CODE_VERSION, THINKING_ROOM, TRIAGE_PROMPT, TRIAGE_SCHEMA, TRIAGE_VERSION } from "./passage-triage.policy"

import { objectLike, stageRulesOf, STAGES_CUT_SPEND, STAGES_RULE, STAGES_RULES_DOC, STAGES_STATE, STAGES_TABLE, STAGES_USAGE, scriptStageDoubles, stagePassageOf, stageReply, stageSource } from "@tests/fixtures/builders/brain-document.builder"

const WS = DOC_WS
const SOURCE = DOC_SOURCE
const source = stageSource

const build = async () => {
    const ai = mock<AiService>()
    const logger = mock<Logger>()
    const facts = mock<BrainFactsService>()
    const extractions = mock<BrainExtractionsService>()
    const chunks = mock<KnowledgeChunksService>()
    const usage = mock<UsageMeterService>()
    const vectors = mock<FactEmbeddingsService>()
    const nature = mock<DocumentNatureService>()
    scriptStageDoubles({ ai, usage, vectors, nature })
    const moduleRef = await Test.createTestingModule({
        providers: [
            DocumentTruthStagesService,
            ModelJsonService,
            { provide: AI, useValue: ai },
            { provide: LOGGER, useValue: logger },
            { provide: CLOCK, useValue: new FakeClock(new Date("2026-11-11T15:00:00.000Z")) },
            { provide: BrainFactsService, useValue: facts },
            { provide: BrainExtractionsService, useValue: extractions },
            { provide: KnowledgeChunksService, useValue: chunks },
            { provide: UsageMeterService, useValue: usage },
            { provide: FactEmbeddingsService, useValue: vectors },
            { provide: DocumentNatureService, useValue: nature },
            { provide: WorkspaceTimeZoneService, useValue: mock<WorkspaceTimeZoneService>({ timeZoneOf: () => Promise.resolve("Asia/Ho_Chi_Minh") }) },
        ],
    }).compile()
    return { service: moduleRef.get(DocumentTruthStagesService), ai, facts, extractions, chunks, usage, vectors, logger, nature }
}

describe("DocumentTruthStagesService triage", () => {
    it("a table the document's map judged records is data for no passage call; the rule material goes to one call", async () => {
        const t = await build()
        const tables = { [tableKeyOf("ticket | bike | price")]: "records" as const }
        t.nature.natureFor.mockResolvedValue({ kind: "ready", nature: { ...STAGES_RULES_DOC, tables }, calls: 1 })
        t.ai.chat.mockResolvedValue(stageReply('{"rule":[1]}'))
        const passages = [
            stagePassageOf(0, STAGES_TABLE),
            stagePassageOf(1, STAGES_RULE),
            stagePassageOf(2, "A short story about how the shop began on a small corner."),
        ]

        const result = await t.service.triage({ source, passages, state: STAGES_STATE })

        expect(result.end).toBe("done")
        expect(result.passages.map((passage) => passage.triage)).toEqual(["data", "rule", "none"])
        expect(t.ai.chat).toHaveBeenCalledTimes(1)
        expect(t.ai.chat.mock.calls[0]?.[0].messages[0]?.content).toBe(TRIAGE_PROMPT)
        // A decision of meaning on the strong model (owner 2026-11-12), the standing instructions marked for the provider's cache.
        expect(t.ai.chat.mock.calls[0]?.[0]).toMatchObject({ target: INGESTION_TARGET })
        expect(t.ai.chat.mock.calls[0]?.[0].messages[0]?.cacheMark).toBe(true)
        expect(t.nature.natureFor).toHaveBeenCalledWith(source, passages, STAGES_STATE.hash)
        expect(t.chunks.setTriage).toHaveBeenNthCalledWith(1, WS, [{ id: "c0", verdict: "data" }], INHERITED_VERSION)
        expect(t.chunks.setTriage).toHaveBeenNthCalledWith(
            2,
            WS,
            [
                { id: "c1", verdict: "rule" },
                { id: "c2", verdict: "none" },
            ],
            TRIAGE_VERSION,
        )
        expect(t.extractions.save).toHaveBeenLastCalledWith(
            WS,
            SOURCE,
            objectLike({
                status: "running",
                stage: "triage",
                counts: { passagesTotal: 3, passagesTriaged: 3 },
            }),
        )
    })

    it("does nothing for passages already judged by this version", async () => {
        const t = await build()
        const passages = [stagePassageOf(0, STAGES_RULE, { triage: "rule", triageVersion: TRIAGE_VERSION })]

        await expect(t.service.triage({ source, passages, state: STAGES_STATE })).resolves.toMatchObject({
            end: "done",
            passages,
        })
        expect(t.ai.chat).not.toHaveBeenCalled()
        expect(t.chunks.setTriage).not.toHaveBeenCalled()
    })

    it("waits with no call when the credit pool is empty", async () => {
        const t = await build()
        t.usage.blockedBy.mockResolvedValue(true)

        await expect(t.service.triage({ source, passages: [stagePassageOf(0, STAGES_RULE)], state: STAGES_STATE })).resolves.toMatchObject(
            { end: "blocked" },
        )
        expect(t.ai.chat).not.toHaveBeenCalled()
        expect(t.extractions.save).toHaveBeenLastCalledWith(
            WS,
            SOURCE,
            objectLike({ status: "blocked_credits", error: StoredNote.NoCreditsForFacts }),
        )
    })
})

describe("DocumentTruthStagesService triage: passages inherit what the document is (TRIAGE-2)", () => {
    const LOG: NatureInForce = { nature: "log", sections: [], tables: {}, by: "model" }

    it("a log (or reference, or records) gives no passage to triage: no passage call, every passage none for the nature's version", async () => {
        const t = await build()
        t.nature.natureFor.mockResolvedValue({ kind: "ready", nature: LOG, calls: 1 })
        const passages = [stagePassageOf(0, STAGES_RULE), stagePassageOf(1, "Monday: three bikes in, the compressor was noisy again today.")]

        const result = await t.service.triage({ source, passages, state: STAGES_STATE })

        expect(result.end).toBe("done")
        expect(result.passages.map((passage) => passage.triage)).toEqual(["none", "none"])
        expect(t.ai.chat).not.toHaveBeenCalled()
        expect(t.chunks.setTriage).toHaveBeenCalledWith(
            WS,
            [
                { id: "c0", verdict: "none" },
                { id: "c1", verdict: "none" },
            ],
            INHERITED_VERSION,
        )
        expect(t.facts.withdrawChanged).not.toHaveBeenCalled()
    })

    it("a passage that leaves rule material (the founder said the document holds no rules) withdraws what it supported", async () => {
        const t = await build()
        t.nature.natureFor.mockResolvedValue({ kind: "ready", nature: { ...LOG, by: "founder" }, calls: 0 })
        t.facts.withdrawChanged.mockResolvedValue({ orphans: ["f9"], withdrawn: 2 })
        const kept = stagePassageOf(1, "Short.", { triage: "none", triageVersion: CODE_VERSION })
        const passages = [stagePassageOf(0, STAGES_RULE, { triage: "rule", triageVersion: TRIAGE_VERSION, truthsVersion: 6 }), kept]

        await t.service.triage({ source, passages, state: STAGES_STATE })

        expect(t.facts.withdrawChanged).toHaveBeenCalledWith(WS, SOURCE, "not rule material", {
            hashes: [kept.hash],
            folded: foldedText(kept.text),
        })
        expect(t.facts.finalizeOrphans).toHaveBeenCalledWith(WS, ["f9"], objectLike({ kind: "note" }))
    })

    it("the founder's answer back to rules sends the passages the nature had decided to the model", async () => {
        const t = await build()
        t.ai.chat.mockResolvedValue(stageReply('{"rule":[1]}'))
        const passages = [stagePassageOf(0, STAGES_RULE, { triage: "none", triageVersion: INHERITED_VERSION })]

        const result = await t.service.triage({ source, passages, state: STAGES_STATE })

        expect(result.passages.map((passage) => passage.triage)).toEqual(["rule"])
        expect(t.chunks.setTriage).toHaveBeenCalledWith(WS, [{ id: "c0", verdict: "rule" }], TRIAGE_VERSION)
    })

    it("waits for credits when the map cannot be asked, and is retried by the queue when the model did not answer it", async () => {
        const t = await build()
        t.nature.natureFor.mockResolvedValueOnce({ kind: "blocked" })
        await expect(t.service.triage({ source, passages: [stagePassageOf(0, STAGES_RULE)], state: STAGES_STATE })).resolves.toMatchObject({
            end: "blocked",
        })
        expect(t.extractions.save).toHaveBeenLastCalledWith(
            WS,
            SOURCE,
            objectLike({ status: "blocked_credits", error: StoredNote.NoCreditsForFacts }),
        )
        t.nature.natureFor.mockResolvedValueOnce({ kind: "retry" })
        await expect(t.service.triage({ source, passages: [stagePassageOf(0, STAGES_RULE)], state: STAGES_STATE })).resolves.toMatchObject({
            end: "retry",
            state: { attempts: 1 },
        })
        expect(t.ai.chat).not.toHaveBeenCalled()
    })
})

describe("DocumentTruthStagesService: booking per try and per stage", () => {
    it("books a call cut at its cap with what it spent, once, and counts it as a failed try", async () => {
        const t = await build()
        const served = { upstream: "anthropic", finishReason: "max_tokens", durationMs: 4 }
        t.ai.attempt.mockResolvedValue({
            ok: false,
            failure: "length",
            spent: { model: "claude-haiku-5-5", usage: STAGES_USAGE, served, cap: 200 },
        })

        const cut = await t.service.triage({ source, passages: [stagePassageOf(0, STAGES_RULE)], state: STAGES_STATE })

        // One passage cut alone is judged `rule` (never a lost rule, never the same prompt again, never a job error: D-N-9).
        expect(cut).toMatchObject({ end: "done", state: { attempts: 0 } })
        expect(cut.passages[0]?.triage).toBe("rule")
        expect(t.usage.record).toHaveBeenCalledTimes(1)
        expect(t.usage.record).toHaveBeenCalledWith(
            objectLike({
                workspaceId: WS,
                kind: "brain",
                model: "claude-haiku-5-5",
                usage: STAGES_USAGE,
                completionChars: 0,
            }),
        )
    })

    it("books each call as its stage inside the document's reading (work_kind kept, step_key triage)", async () => {
        const t = await build()
        t.ai.chat.mockResolvedValue(stageReply('{"rule":[1],"data":[]}'))
        const scopes: Array<unknown> = []
        t.usage.record.mockImplementation(() => {
            scopes.push(workInScope())
            return Promise.resolve()
        })

        await withWorkScope({ kind: "document_read", ref: `source:${SOURCE}` }, () =>
            t.service.triage({ source, passages: [stagePassageOf(0, STAGES_RULE)], state: STAGES_STATE }),
        )

        expect(scopes).toEqual([{ kind: "document_read", ref: `source:${SOURCE}`, stepKey: "triage", agentId: null }])
    })

    it("counts a try the model did not answer at all, and gives up at the third in a row", async () => {
        const t = await build()
        t.ai.chat.mockResolvedValue(null)

        const first = await t.service.triage({ source, passages: [stagePassageOf(0, STAGES_RULE)], state: STAGES_STATE })
        expect(first).toMatchObject({ end: "retry", state: { attempts: 1 } })
        const third = await t.service.triage({
            source,
            passages: [stagePassageOf(0, STAGES_RULE)],
            state: { ...STAGES_STATE, attempts: 2 },
        })
        expect(third).toMatchObject({ end: "gave_up", state: { attempts: 3 } })
        expect(t.extractions.save).toHaveBeenLastCalledWith(
            WS,
            SOURCE,
            objectLike({ status: "failed", error: ExtractionNote.ModelBusy, attempts: 3 }),
        )
    })
})

describe("DocumentTruthStagesService triage: an answer cut at its cap (D-N-9)", () => {
    it("sizes the cap from the batch and, when the answer is cut, splits the batch and judges the halves", async () => {
        const t = await build()
        // The dev shape: the answer of 12 passages ran past its cap (`ai.chat.cut answerChars 559`); the halves answer.
        t.ai.attempt
            .mockResolvedValueOnce({ ok: false, failure: "length", spent: STAGES_CUT_SPEND })
            .mockResolvedValueOnce({ ok: true, answer: stageReply('{"rule":[1,2],"data":[]}') })
            .mockResolvedValueOnce({ ok: true, answer: stageReply('{"rule":[],"data":[]}') })
        const passages = Array.from({ length: 12 }, (_, index) => stagePassageOf(index, `${STAGES_RULE} (${String(index)})`))

        const result = await t.service.triage({ source, passages, state: STAGES_STATE })

        expect(result.end).toBe("done")
        expect(t.ai.attempt).toHaveBeenCalledTimes(3)
        expect(t.ai.attempt.mock.calls[0]?.[0].budget?.maxTokens).toBe(THINKING_ROOM + 80 + 24 * 12)
        expect(t.ai.attempt.mock.calls[1]?.[0].budget?.maxTokens).toBe(THINKING_ROOM + 80 + 24 * 6)
        expect(result.passages.filter((passage) => passage.triage === "rule").map((passage) => passage.id)).toEqual([
            "c0",
            "c1",
        ])
        expect(result.passages.every((passage) => passage.triage !== null)).toBe(true)
        expect(t.usage.record).toHaveBeenCalledTimes(3)
    })

    it("splits a window cut at its cap and reads the halves; skips a single cut passage", async () => {
        const t = await build()
        t.ai.attempt
            .mockResolvedValueOnce({ ok: false, failure: "length", spent: { ...STAGES_CUT_SPEND, cap: 2500 } })
            .mockResolvedValueOnce({ ok: true, answer: stageReply("NONE") })
            .mockResolvedValueOnce({ ok: true, answer: stageReply("NONE") })

        const result = await t.service.extract({ source, passages: stageRulesOf(4), state: STAGES_STATE })

        expect(result).toMatchObject({ end: "done", state: { done: 2 } })
        expect(t.ai.attempt).toHaveBeenCalledTimes(3)
        expect(t.chunks.markTruthsRead).toHaveBeenCalledWith(WS, ["c0", "c1"], TRUTHS_VERSION)
        expect(t.chunks.markTruthsRead).toHaveBeenCalledWith(WS, ["c2", "c3"], TRUTHS_VERSION)
    })
})

describe("DocumentTruthStagesService: the reading thinks at effort high (owner 2026-11-12)", () => {
    it("asks triage and extraction at effort high with room for the reasoning and the whole answer", async () => {
        const t = await build()
        t.ai.chat.mockResolvedValueOnce(stageReply('{"rule":[1]}')).mockResolvedValueOnce(stageReply("NONE"))
        const passages = [stagePassageOf(0, STAGES_RULE)]

        const judged = await t.service.triage({ source, passages, state: STAGES_STATE })
        await t.service.extract({ source, passages: judged.passages, state: STAGES_STATE })

        const [triage, extraction] = t.ai.attempt.mock.calls.map((call) => call[0].budget)
        expect(triage).toMatchObject({ effort: "high" })
        // Triage answers through the API's structured output where the route has it (TRIAGE-5); extraction stays line text.
        const [triageCall, extractionCall] = t.ai.attempt.mock.calls.map((call) => call[0])
        expect(triageCall?.outputSchema).toEqual(TRIAGE_SCHEMA)
        expect(extractionCall?.outputSchema).toBeUndefined()
        expect(extraction).toMatchObject({ effort: "high" })
        expect(triage?.maxTokens).toBeGreaterThanOrEqual(THINKING_ROOM)
        expect(extraction?.maxTokens).toBeGreaterThanOrEqual(THINKING_ROOM + 200 * 35)
    })
})

