import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { DOC_SOURCE, DOC_WS } from "@tests/fixtures/builders/document-facts.builder"
import { BrainExtractionsService } from "@modules/domain/brain-extractions"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { KnowledgeChunksService, passageTextHashOf } from "@modules/domain/knowledge-chunks"
import { UsageMeterService } from "@modules/domain/knowledge"
import { AI } from "@modules/integrations/ai"
import type { AiService } from "@modules/integrations/ai"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DocumentTruthStagesService } from "./document-truth-stages.service"
import { SKIPPED_VERSION, SYSTEM_PROMPT, TRUTHS_VERSION } from "./extraction.policy"
import { FactEmbeddingsService } from "./fact-embeddings.service"
import { ModelJsonService } from "./model-json.service"
import { DocumentNatureService } from "./document-nature.service"
import { CODE_VERSION, TRIAGE_VERSION } from "./passage-triage.policy"
import { CAC_DOAN_NAY_LA_HOI_THOAI_KHACH_HANG_KHONG_C_2_VI, CAC_DOAN_NAY_LA_HOI_THOAI_KHACH_HANG_KHONG_C_VI, HOI_THOAI_VI, TOI_KHONG_TIM_THAY_QUY_DINH_VI, TOI_KHONG_VI } from "@tests/fixtures/i18n/brain-b-spec.messages"
import { objectLike, stageRulesOf, STAGES_RULE, STAGES_STATE, STAGES_TABLE, filedAs, scriptStageDoubles, stagePassageOf, stageReply, stageSource } from "@tests/fixtures/builders/brain-document.builder"

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

describe("DocumentTruthStagesService extract", () => {
    it("reads only the rule passages not read by this version and files each truth as a proposal naming its passage", async () => {
        const t = await build()
        t.ai.chat.mockResolvedValue(stageReply("1|policy|Shipping inside the city|fee|30.000 VND|-|-|-"))
        t.facts.propose.mockImplementation((_ws, input) => filedAs("f1", input.value))
        const passages = [
            stagePassageOf(0, STAGES_RULE, { triage: "rule", triageVersion: TRIAGE_VERSION }),
            stagePassageOf(1, STAGES_TABLE, { triage: "data", triageVersion: CODE_VERSION }),
            stagePassageOf(2, "Opening hours are 8h-21h every day.", {
                triage: "rule",
                triageVersion: TRIAGE_VERSION,
                truthsVersion: TRUTHS_VERSION,
            }),
        ]

        const result = await t.service.extract({ source, passages, state: STAGES_STATE })

        expect(result).toMatchObject({ end: "done", state: { done: 1, filed: 1, model: "haiku" } })
        expect(result.passages[0]?.truthsVersion).toBe(TRUTHS_VERSION)
        expect(t.ai.chat).toHaveBeenCalledTimes(1)
        const [request] = t.ai.chat.mock.calls[0] ?? []
        expect(request?.messages[0]?.content).toBe(SYSTEM_PROMPT)
        expect(request?.messages[1]?.content).toContain(STAGES_RULE)
        expect(request?.messages[1]?.content).not.toContain("A1 | rose")
        expect(t.facts.propose).toHaveBeenCalledWith(
            WS,
            objectLike({
                value: "30.000 VND",
                autoApply: false,
                sourceKind: "document",
                evidence: [objectLike({ sourceId: SOURCE, chunkHash: passageTextHashOf(STAGES_RULE) })],
            }),
        )
        expect(t.chunks.markTruthsRead).toHaveBeenCalledWith(WS, ["c0"], TRUTHS_VERSION)
        expect(t.vectors.checkSameMeaning).toHaveBeenCalledTimes(1)
        expect(t.usage.record).toHaveBeenCalledWith(
            objectLike({ workspaceId: WS, kind: "brain", model: "haiku" }),
        )
    })

    it("stops at the job's budget of calls and says how many batches are left", async () => {
        const t = await build()
        t.ai.chat.mockResolvedValue(stageReply("NONE"))
        const passages = Array.from({ length: 44 }, (_, index) =>
            stagePassageOf(index, `${STAGES_RULE} (${String(index)})`, { triage: "rule", triageVersion: TRIAGE_VERSION }),
        )

        const result = await t.service.extract({ source, passages, state: STAGES_STATE })

        expect(result).toMatchObject({ end: "budget", left: 1, state: { done: 10 } })
        expect(t.ai.chat).toHaveBeenCalledTimes(10)
        expect(result.passages.filter((passage) => passage.truthsVersion === TRUTHS_VERSION)).toHaveLength(40)
    })
})

describe("DocumentTruthStagesService extract: one window never abandons its part (D-N-10)", () => {
    it("asks an unreadable window ONCE more with its own answer, then skips it, records it and reads the next windows", async () => {
        const t = await build()
        t.facts.propose.mockImplementation((_ws, input) => filedAs(`f-${input.value}`, input.value))
        // Window 1: prose twice (the shape R7 4/13 never logged: 45 tokens, no line of eight fields). Window 2: a good line.
        t.ai.chat
            .mockResolvedValueOnce(stageReply(CAC_DOAN_NAY_LA_HOI_THOAI_KHACH_HANG_KHONG_C_VI))
            .mockResolvedValueOnce(stageReply(TOI_KHONG_TIM_THAY_QUY_DINH_VI))
            // The other passages of window 2 state the same rule again: listed as skipped, every line accounted for.
            .mockResolvedValueOnce(stageReply(["1|policy|Shipping inside the city|fee|30.000 VND|-|-|-", "2|skip|L1|duplicate", "3|skip|L1|duplicate", "4|skip|L1|duplicate"].join("\n")))

        const result = await t.service.extract({ source, passages: stageRulesOf(8), state: STAGES_STATE })

        expect(result).toMatchObject({ end: "done", state: { done: 2, filed: 1, attempts: 0 } })
        expect(t.ai.chat).toHaveBeenCalledTimes(3)
        const followUp = t.ai.chat.mock.calls[1]?.[0].messages ?? []
        expect(followUp.map((message) => message.role)).toEqual(["system", "user", "assistant", "user"])
        expect(followUp[3]?.content).toContain("could not be read")
        expect(t.chunks.markTruthsRead).toHaveBeenCalledWith(WS, ["c0", "c1", "c2", "c3"], SKIPPED_VERSION)
        expect(t.chunks.markTruthsRead).toHaveBeenCalledWith(WS, ["c4", "c5", "c6", "c7"], TRUTHS_VERSION)
        expect(t.extractions.note).toHaveBeenCalledWith(
            WS,
            SOURCE,
            objectLike({
                skipped: true,
                note: objectLike({
                    reason: "unreadable",
                    passages: ["c0", "c1", "c2", "c3"],
                    answer: CAC_DOAN_NAY_LA_HOI_THOAI_KHACH_HANG_KHONG_C_2_VI,
                }),
            }),
        )
        // The raw answer is never in a log line: only counts and sizes.
        const logged = JSON.stringify([...t.logger.info.mock.calls, ...t.logger.warn.mock.calls])
        expect(logged).not.toContain(HOI_THOAI_VI)
        expect(logged).not.toContain(TOI_KHONG_VI)
    })

    it("re-asks a window whose every line names a value its passage does not hold, and keeps the better answer (D-N-11, M1)", async () => {
        const t = await build()
        t.facts.propose.mockImplementation((_ws, input) => filedAs(`f-${input.value}`, input.value))
        const passages = [stagePassageOf(0, "Opening hours are 8h-21h every day.", { triage: "rule", triageVersion: TRIAGE_VERSION }), stagePassageOf(1, STAGES_RULE, { triage: "rule", triageVersion: TRIAGE_VERSION })]
        t.ai.chat
            .mockResolvedValueOnce(stageReply("2|business|Shop|opening hours|8h-21h|-|-|-"))
            .mockResolvedValueOnce(stageReply("1|business|Shop|opening hours|8h-21h|-|-|-\n2|skip|L1|unclear"))

        const result = await t.service.extract({ source, passages, state: STAGES_STATE })

        expect(result).toMatchObject({ end: "done", state: { filed: 1 } })
        expect(t.ai.chat).toHaveBeenCalledTimes(2)
        expect(t.usage.record).toHaveBeenLastCalledWith(objectLike({ tryNumber: 2 }))
        // The follow-up names the refused line and why it was refused.
        expect(t.ai.chat.mock.calls[1]?.[0].messages[3]?.content).toContain("the value is not written in the passage the line names")
        // The rule line the second answer skipped as `unclear` is not silent (version 9): counted as unread, its words in the notes.
        expect(t.extractions.note).toHaveBeenCalledTimes(1)
        expect(t.extractions.note).toHaveBeenCalledWith(WS, SOURCE, objectLike({ unread: 1, note: objectLike({ reason: "unaccounted" }) }))
    })

    it("keeps the good lines of a mixed answer and records the refused ones in the reading's notes, not in the log", async () => {
        const t = await build()
        t.facts.propose.mockImplementation((_ws, input) => filedAs(`f-${input.value}`, input.value))
        t.ai.chat.mockResolvedValueOnce(stageReply("Here:\n1|policy|Shipping inside the city|fee|30.000 VND|-|-|-"))

        await t.service.extract({ source, passages: stageRulesOf(1), state: STAGES_STATE })

        expect(t.facts.propose).toHaveBeenCalledTimes(1)
        expect(t.extractions.note).toHaveBeenCalledWith(
            WS,
            SOURCE,
            objectLike({ skipped: false, note: objectLike({ reason: "refused", refused: 1, answer: "Here:" }) }),
        )
    })
})

describe("DocumentTruthStagesService extract: no line of rule material is silent (TRIAGE-3, D-T-5)", () => {
    it("asks once more about lines neither read nor skipped, then counts them in the reading's notes", async () => {
        const t = await build()
        t.facts.propose.mockImplementation((_ws, input) => filedAs(`f-${input.value}`, input.value))
        // A synthetic laundry price list: the model reads the first line and says nothing of the second, twice.
        const list = "Shirt washed and ironed: 20,000 VND.\nSuit dry-cleaned: 90,000 VND."
        const passages = [stagePassageOf(0, list, { triage: "rule", triageVersion: TRIAGE_VERSION })]
        t.ai.chat.mockResolvedValue(stageReply("1|service|Shirt washing|price|20,000 VND|-|-|-"))

        await t.service.extract({ source, passages, state: STAGES_STATE })

        expect(t.ai.chat).toHaveBeenCalledTimes(2)
        expect(t.ai.chat.mock.calls[1]?.[0].messages[3]?.content).toContain("1:L2")
        expect(t.extractions.note).toHaveBeenCalledWith(
            WS,
            SOURCE,
            objectLike({ unread: 1, note: objectLike({ reason: "unaccounted", answer: "1:L2 Suit dry-cleaned: 90,000 VND." }) }),
        )
        expect(t.facts.propose).toHaveBeenCalledTimes(1)
    })
})

