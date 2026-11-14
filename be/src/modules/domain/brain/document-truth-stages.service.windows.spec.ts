import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { DOC_SOURCE, DOC_WS } from "@tests/fixtures/builders/document-facts.builder"
import { BrainExtractionsService } from "@modules/domain/brain-extractions"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { KnowledgeChunksService } from "@modules/domain/knowledge-chunks"
import { UsageMeterService } from "@modules/domain/knowledge"
import { AI } from "@modules/integrations/ai"
import type { AiService } from "@modules/integrations/ai"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DocumentTruthStagesService } from "./document-truth-stages.service"
import { DOCUMENT_DATE_PROMPT, SYSTEM_PROMPT } from "./extraction.policy"
import { FactEmbeddingsService } from "./fact-embeddings.service"
import { ModelJsonService } from "./model-json.service"
import { DocumentNatureService } from "./document-nature.service"
import { TRIAGE_VERSION } from "./passage-triage.policy"
import { objectLike, STAGES_STATE, filedAs, scriptStageDoubles, stagePassageOf, stageReply, stageSource, stringLike } from "@tests/fixtures/builders/brain-document.builder"

const WS = DOC_WS
const SOURCE = DOC_SOURCE

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
    facts.propose.mockImplementation((_ws, input) => filedAs(`f-${input.value}`, input.value))
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
    return { service: moduleRef.get(DocumentTruthStagesService), ai, facts, extractions, chunks, usage, logger }
}

/** A rule passage of a synthetic laundry. */
const rule = (order: number, text: string) => stagePassageOf(order, text, { triage: "rule", triageVersion: TRIAGE_VERSION })

/** The system prompt each model call was sent, in order (counts the fake model's calls by kind). */
const systemsOf = (t: Awaited<ReturnType<typeof build>>): ReadonlyArray<string> =>
    t.ai.chat.mock.calls.map((call) => call[0].messages[0]?.content ?? "")

const WINDOW = "From 24/12/2026 to 26/12/2026 the laundry closes at 18:00."
const BAD_DAY = "1|business|Laundry|closing time|18:00|-|2026-12-24|2026-12-36"

/** The truth of a window line filed with NO period, flagged `period_unclear`, its evidence saying why (D2: never refused, never asked). */
const unclearFiling = (why: string) =>
    objectLike({
        value: "18:00",
        validFrom: null,
        validTo: null,
        flags: ["period_unclear"],
        evidence: [objectLike({ label: stringLike(why) })],
    })

describe("DocumentTruthStagesService extract: a window line whose period cannot be read is told ONCE, then filed without it (D2)", () => {
    it.each([
        ["a day the calendar lacks", BAD_DAY, 'period written "2026-12-24|2026-12-36" is not a calendar day'],
        ["words in a date field", "1|business|Laundry|closing time|18:00|-|Christmas Eve|after Christmas", "is not a calendar day"],
        ["an end before its start", "1|business|Laundry|closing time|18:00|-|2026-12-26|2026-12-24", "ends before it starts"],
    ])("%s: one told follow-up (two calls, never more), then the truth is filed with no period and the flag", async (_case, line, why) => {
        const t = await build()
        t.ai.chat.mockResolvedValue(stageReply(line))

        const result = await t.service.extract({ source: stageSource, passages: [rule(0, WINDOW)], state: STAGES_STATE })

        expect(t.ai.chat).toHaveBeenCalledTimes(2)
        expect(systemsOf(t)).toEqual([SYSTEM_PROMPT, SYSTEM_PROMPT])
        const told = t.ai.chat.mock.calls[1]?.[0].messages[3]?.content ?? ""
        expect(told).toContain(line)
        expect(told).toContain("the truth is kept without its period")
        // Counted as filed, not refused: no refused or unread line on the reading.
        expect(result).toMatchObject({ end: "done", state: { done: 1, filed: 1 } })
        expect(t.facts.propose).toHaveBeenCalledTimes(1)
        expect(t.facts.propose).toHaveBeenCalledWith(WS, unclearFiling(why))
        expect(t.extractions.note).not.toHaveBeenCalled()
    })

    it("files the mended line of the follow-up with its window, the last day included", async () => {
        const t = await build()
        t.ai.chat
            .mockResolvedValueOnce(stageReply(BAD_DAY))
            .mockResolvedValueOnce(stageReply("1|business|Laundry|closing time|18:00|-|2026-12-24|2026-12-26"))

        await t.service.extract({ source: stageSource, passages: [rule(0, WINDOW)], state: STAGES_STATE })

        expect(t.ai.chat).toHaveBeenCalledTimes(2)
        expect(t.facts.propose).toHaveBeenCalledTimes(1)
        expect(t.facts.propose).toHaveBeenCalledWith(
            WS,
            objectLike({ value: "18:00", validFrom: "2026-12-23T17:00:00.000Z", validTo: "2026-12-26T17:00:00.000Z" }),
        )
        expect(t.facts.propose.mock.calls[0]?.[1].flags).toBeUndefined()
        expect(t.extractions.note).not.toHaveBeenCalled()
    })

    it("keeps a line the model skipped as unclear visible in the counters after its one follow-up", async () => {
        const t = await build()
        t.ai.chat.mockResolvedValue(stageReply("1|skip|L1|unclear"))

        await t.service.extract({ source: stageSource, passages: [rule(0, WINDOW)], state: STAGES_STATE })

        expect(t.ai.chat).toHaveBeenCalledTimes(2)
        expect(t.ai.chat.mock.calls[1]?.[0].messages[3]?.content).toContain("You listed these lines as unclear: 1:L1")
        expect(t.extractions.note).toHaveBeenCalledWith(WS, SOURCE, objectLike({ unread: 1 }))
    })

    it("counts a truth the store refused to file as a refused line, never silent", async () => {
        const t = await build()
        t.ai.chat.mockResolvedValue(stageReply("1|business|Laundry|closing time|18:00|-|2026-12-24|2026-12-26"))
        t.facts.propose.mockRejectedValue(new Error("refused by the store"))

        await t.service.extract({ source: stageSource, passages: [rule(0, WINDOW)], state: STAGES_STATE })

        expect(t.extractions.note).toHaveBeenCalledWith(
            WS,
            SOURCE,
            objectLike({ skipped: false, note: objectLike({ reason: "refused", refused: 1, answer: "Laundry|closing time|18:00" }) }),
        )
    })
})

const NOTICE = "Laundry notice, issued 20/02/2026."
const RELATIVE = "Express service costs 15,000 VND extra for the next 14 days."
const RELATIVE_LINE = "1|service|Express service|surcharge|15,000 VND|-|D+0|D+13"

describe("DocumentTruthStagesService extract: a period relative to the document's own date", () => {
    it("is computed from the date the document states (read once by the model, checked against its line) and says so", async () => {
        const t = await build()
        t.ai.chat.mockResolvedValueOnce(stageReply(RELATIVE_LINE)).mockResolvedValueOnce(stageReply("1|2026-02-20"))
        // The notice line is no rule material: never read for truths, but shown to the date call.
        const passages = [stagePassageOf(0, NOTICE, { triage: "none", triageVersion: TRIAGE_VERSION }), rule(1, RELATIVE)]

        await t.service.extract({ source: stageSource, passages, state: STAGES_STATE })

        expect(systemsOf(t)).toEqual([SYSTEM_PROMPT, DOCUMENT_DATE_PROMPT])
        expect(t.ai.chat.mock.calls[1]?.[0].messages[1]?.content).toContain(`L1 ${NOTICE}`)
        expect(t.facts.propose).toHaveBeenCalledWith(
            WS,
            objectLike({
                value: "15,000 VND",
                validFrom: "2026-02-19T17:00:00.000Z",
                validTo: "2026-03-05T17:00:00.000Z",
                evidence: [objectLike({ label: stringLike("period computed from the document's date 2026-02-20") })],
            }),
        )
        expect(t.facts.propose.mock.calls[0]?.[1].flags).toBeUndefined()
        // The extraction prompt shows no date of the stored file.
        expect(t.ai.chat.mock.calls[0]?.[0].messages[1]?.content).not.toContain("Updated")
    })

    it("is filed without a period, flagged, saying which date is missing, when the document states none (never the upload date)", async () => {
        const t = await build()
        t.ai.chat.mockResolvedValueOnce(stageReply(RELATIVE_LINE)).mockResolvedValueOnce(stageReply("NONE"))

        const result = await t.service.extract({ source: stageSource, passages: [rule(0, RELATIVE)], state: STAGES_STATE })

        // The line itself is well formed: no follow-up, one call for the document's date.
        expect(systemsOf(t)).toEqual([SYSTEM_PROMPT, DOCUMENT_DATE_PROMPT])
        expect(result).toMatchObject({ state: { filed: 1 } })
        expect(t.facts.propose).toHaveBeenCalledWith(
            WS,
            objectLike({
                validFrom: null,
                validTo: null,
                flags: ["period_unclear"],
                evidence: [objectLike({ label: stringLike("which the document does not state: the period cannot be computed") })],
            }),
        )
        expect(t.extractions.note).not.toHaveBeenCalled()
    })

    it("is filed without a period, flagged, when the period computed from the stated date ends before it starts", async () => {
        const t = await build()
        // A written start after the end computed from the document's date (D+0 = 2026-02-20): a form code cannot compute.
        t.ai.chat
            .mockResolvedValueOnce(stageReply("1|service|Express service|surcharge|15,000 VND|-|2026-03-10|D+0"))
            .mockResolvedValueOnce(stageReply("1|2026-02-20"))
        const passages = [stagePassageOf(0, NOTICE, { triage: "none", triageVersion: TRIAGE_VERSION }), rule(1, RELATIVE)]

        await t.service.extract({ source: stageSource, passages, state: STAGES_STATE })

        expect(systemsOf(t)).toEqual([SYSTEM_PROMPT, DOCUMENT_DATE_PROMPT])
        expect(t.facts.propose).toHaveBeenCalledWith(
            WS,
            objectLike({
                validFrom: null,
                validTo: null,
                flags: ["period_unclear"],
                evidence: [objectLike({ label: stringLike("cannot be computed") })],
            }),
        )
    })

    it("asks for the document's date at most once per job, and not at all when no period is relative", async () => {
        const t = await build()
        // Two windows (five passages, four to a call), each with a relative period: three calls, one of them for the date.
        const passages = [0, 1, 2, 3, 4].map((order) => rule(order, RELATIVE))
        t.ai.chat
            .mockResolvedValueOnce(stageReply([RELATIVE_LINE, "2|skip|L1|duplicate", "3|skip|L1|duplicate", "4|skip|L1|duplicate"].join("\n")))
            .mockResolvedValueOnce(stageReply("NONE"))
            .mockResolvedValueOnce(stageReply(RELATIVE_LINE))

        await t.service.extract({ source: stageSource, passages, state: STAGES_STATE })

        expect(systemsOf(t)).toEqual([SYSTEM_PROMPT, DOCUMENT_DATE_PROMPT, SYSTEM_PROMPT])
        expect(t.usage.record).toHaveBeenCalledTimes(3)

        const plain = await build()
        plain.ai.chat.mockResolvedValue(stageReply("1|business|Laundry|closing time|18:00|-|2026-12-24|2026-12-26"))
        await plain.service.extract({ source: stageSource, passages: [rule(0, WINDOW)], state: STAGES_STATE })
        expect(systemsOf(plain)).toEqual([SYSTEM_PROMPT])
    })
})
