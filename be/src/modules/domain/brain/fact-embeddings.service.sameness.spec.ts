import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { BrainFactEmbeddingsService, BrainFactsReadService, BrainFactsService } from "@modules/domain/brain-facts"
import type { FactEmbeddingState } from "@modules/domain/brain-facts"
import { UsageMeterService } from "@modules/domain/knowledge"
import { EMBEDDING_DIMENSIONS } from "@modules/domain/knowledge-chunks"
import { AI } from "@modules/integrations/ai"
import type { AiService } from "@modules/integrations/ai"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { VectorSyncService } from "@modules/domain/vector-sync"
import { FactEmbeddingsService } from "./fact-embeddings.service"
import { FactReadingLogEvent } from "./fact-reading.log-events"
import { ModelJsonService } from "./model-json.service"
import { SAME_FACT_PROMPT } from "./same-fact.policy"
import { EMBEDDING_PROFILE, EMBEDDING_WS, embeddingFactOf, embeddingVectorOf, parsedJsonOf, scriptEmbeddingDoubles } from "@tests/fixtures/builders/brain-embeddings.builder"

const WS = EMBEDDING_WS
const PROFILE = EMBEDDING_PROFILE
const factOf = embeddingFactOf
const parsedJson = parsedJsonOf
const vector = embeddingVectorOf

const build = async (states: ReadonlyArray<FactEmbeddingState>) => {
    const ai = mock<AiService>()
    const logger = mock<Logger>()
    const usage = mock<UsageMeterService>()
    const vectors = mock<BrainFactEmbeddingsService>()
    const facts = mock<BrainFactsService>()
    const json = mock<ModelJsonService>()
    const reads = mock<BrainFactsReadService>()
    const sync = mock<VectorSyncService>()
    scriptEmbeddingDoubles({ ai, vectors, reads, sync }, states)
    const moduleRef = await Test.createTestingModule({
        providers: [
            FactEmbeddingsService,
            { provide: AI, useValue: ai },
            { provide: LOGGER, useValue: logger },
            { provide: UsageMeterService, useValue: usage },
            { provide: BrainFactEmbeddingsService, useValue: vectors },
            { provide: BrainFactsService, useValue: facts },
            { provide: ModelJsonService, useValue: json },
            { provide: BrainFactsReadService, useValue: reads },
            { provide: VectorSyncService, useValue: sync },
        ],
    }).compile()
    return { service: moduleRef.get(FactEmbeddingsService), ai, logger, usage, vectors, facts, json, reads, sync }
}

/** What the judge answers: the number of the candidate that is the same truth, or none. */
interface SameAnswer {
    readonly same: number | null
}

/** A new proposal of a document, in other words than the value in force. */
const filed = factOf({
    id: "new",
    status: "proposed",
    subjectKey: "bo-hong-do-10-bong",
    subjectLabel: "B\u00f3 h\u1ed3ng \u0111\u1ecf 10 b\u00f4ng",
    attribute: "gia",
    attributeLabel: "Gi\u00e1",
    value: "400.000 \u0111",
    unit: null,
})
const known = factOf({
    id: "known",
    subjectKey: "bo-hoa-hong-do-10-bong",
    subjectLabel: "B\u00f3 hoa h\u1ed3ng \u0111\u1ecf 10 b\u00f4ng",
    attribute: "gia",
    attributeLabel: "Gi\u00e1",
    value: "350.000 \u0111",
    unit: null,
})
const sameKey = factOf({ ...filed, id: "same-key", status: "active", value: "380.000 \u0111" })
const sibling = factOf({ ...known, id: "sibling", subjectKey: "gio-hoa-nho" })
const unembedded: FactEmbeddingState = { fact: filed, stored: { model: null, dimensions: null, hash: null } }

/** An answered try of the judge with this verdict. */
const answeredWith = (verdict: object) => ({
    ok: true as const,
    answer: {
        text: JSON.stringify(verdict),
        parsed: null,
        model: "work",
        usage: { promptTokens: 60, completionTokens: 120, totalTokens: 180, costUsd: 0 },
        retrieved: 0,
        served: { upstream: "anthropic", finishReason: "end_turn", durationMs: 900 },
    },
})

const scripted = async (verdict: object = { same: 2, sameValue: false }) => {
    const parts = await build([])
    parts.vectors.statesOf.mockResolvedValue([unembedded])
    parts.ai.embed.mockResolvedValue({ vectors: [vector(7)], usage: null })
    parts.vectors.nearestTo.mockResolvedValue([
        { fact: sameKey, distance: 0.02 },
        { fact: sibling, distance: 0.05 },
        { fact: known, distance: 0.08 },
    ])
    parts.usage.blockedBy.mockResolvedValue(false)
    parts.ai.attempt.mockResolvedValue(answeredWith(verdict))
    parts.json.jsonOf.mockImplementation(parsedJson)
    parts.facts.flagSameMeaning.mockResolvedValue(true)
    parts.facts.mergeDuplicate.mockResolvedValue(known)
    return parts
}

describe("FactEmbeddingsService: the same fact in other words (BG2 P4b), scripted vectors and judgement", () => {
    it("embeds the new proposal once (its point kept, so its approval sends nothing) and reads its candidates by its own point", async () => {
        const { service, ai, vectors, sync } = await scripted({ same: null })

        await service.checkSameMeaning(WS, [filed])

        expect(ai.embed).toHaveBeenCalledTimes(1)
        expect(sync.accept.mock.calls.map((call) => [call[0], call[1], [...call[2].keys()]])).toEqual([["truth", WS, ["new"]]])
        expect(vectors.nearestTo.mock.calls[0]?.slice(1, 3)).toEqual(["new", { model: PROFILE, dimensions: EMBEDDING_DIMENSIONS }])
    })

    it("shows the judge a candidate whose labels name other numbers: code leaves no candidate out for what its labels say", async () => {
        const { service, ai, vectors, facts } = await scripted({ same: 1, sameValue: false, sameScope: true })
        // Another trade: two truths filed under different names whose labels name different numbers (per 5 visits / per 1 visit).
        const perFive = factOf({ ...filed, id: "per-five", subjectKey: "the-thanh-vien", subjectLabel: "Th\u1ebb th\u00e0nh vi\u00ean", attribute: "luot-tang-moi-5-lan", attributeLabel: "L\u01b0\u1ee3t t\u1eb7ng cho m\u1ed7i 5 l\u1ea7n gi\u1eb7t", value: "2 l\u01b0\u1ee3t" })
        const perOne = factOf({ ...known, id: "per-one", subjectKey: "tich-luot", subjectLabel: "T\u00edch l\u01b0\u1ee3t", attribute: "so-lan-de-tang-1-luot", attributeLabel: "S\u1ed1 l\u1ea7n gi\u1eb7t \u0111\u1ec3 t\u1eb7ng 1 l\u01b0\u1ee3t", value: "5 l\u1ea7n" })
        vectors.statesOf.mockResolvedValue([{ fact: perFive, stored: { model: null, dimensions: null, hash: null } }])
        vectors.nearestTo.mockResolvedValue([{ fact: perOne, distance: 0.31 }])

        await expect(service.checkSameMeaning(WS, [perFive])).resolves.toMatchObject({ judged: 1, flagged: 1 })

        expect(ai.attempt).toHaveBeenCalledTimes(1)
        expect(ai.attempt.mock.calls[0]?.[0].messages[1]?.content).toContain("1. T\u00edch l\u01b0\u1ee3t")
        expect(facts.flagSameMeaning).toHaveBeenCalledWith(WS, "per-five", "per-one")
        // The bounds of the read are unchanged: the nearest JUDGE_VECTOR_CANDIDATES within JUDGE_DISTANCE_CAP.
        expect(vectors.nearestTo.mock.calls[0]?.[3]).toEqual(expect.objectContaining({ maxDistance: 0.45, limit: 9 }))
    })
})

describe("FactEmbeddingsService: the same fact in other words: the judge's one call over the nearest truths", () => {
    it("judges ONE call over the nearest truths by vector AND the truths sharing its words; the same truth with another value is a contradiction for the founder", async () => {
        const { service, ai, facts, usage, logger, vectors, reads } = await scripted({ same: 2, sameValue: false })
        const byWords = factOf({ ...known, id: "by-words", subjectKey: "hoa-hong-do-bo-10" })
        reads.wordHits.mockResolvedValue([byWords, factOf({ ...sameKey, id: "word-same-key" })])

        await expect(service.checkSameMeaning(WS, [filed])).resolves.toEqual({
            judged: 1,
            flagged: 1,
            merged: 0,
            unsure: 0,
        })

        expect(vectors.nearestTo.mock.calls[0]?.[3]).toEqual({
            statuses: ["active", "scheduled", "proposed"],
            installationId: null,
            maxDistance: 0.45,
            limit: 9,
        })
        expect(reads.wordHits).toHaveBeenCalledWith(
            WS,
            "internal",
            "",
            null,
            "B\u00f3 h\u1ed3ng \u0111\u1ecf 10 b\u00f4ng Gi\u00e1",
        )
        expect(ai.attempt).toHaveBeenCalledTimes(1)
        expect(ai.attempt.mock.calls[0]?.[0]).toMatchObject({
            messages: [
                { role: "system", content: SAME_FACT_PROMPT },
                {
                    role: "user",
                    content:
                        "NEW: B\u00f3 h\u1ed3ng \u0111\u1ecf 10 b\u00f4ng - Gi\u00e1: 400.000 \u0111\nKNOWN:\n1. B\u00f3 hoa h\u1ed3ng \u0111\u1ecf 10 b\u00f4ng - Gi\u00e1: 350.000 \u0111\n2. B\u00f3 hoa h\u1ed3ng \u0111\u1ecf 10 b\u00f4ng - Gi\u00e1: 350.000 \u0111\n3. B\u00f3 hoa h\u1ed3ng \u0111\u1ecf 10 b\u00f4ng - Gi\u00e1: 350.000 \u0111",
                },
            ],
            budget: { effort: "high", maxTokens: 8000 },
        })
        expect(facts.flagSameMeaning).toHaveBeenCalledWith(WS, "new", "known")
        expect(facts.mergeDuplicate).not.toHaveBeenCalled()
        expect(usage.record).toHaveBeenCalledWith(
            expect.objectContaining({ workspaceId: WS, kind: "brain", tryNumber: 1 }),
        )
        expect(logger.info).toHaveBeenCalledWith(FactReadingLogEvent.SameMeaningChecked, {
            workspaceId: WS,
            judged: 1,
            flagged: 1,
            merged: 0,
            unsure: 0,
        })
    })

    it("closes the same truth with the SAME value as a duplicate (no question), the value compared in its normal form", async () => {
        const twin = factOf({ ...sibling, id: "twin", value: "400k" })
        const parts = await scripted({ same: 1, sameValue: false })
        parts.vectors.nearestTo.mockResolvedValue([{ fact: twin, distance: 0.09 }])

        // The judge read the values as different; the normal form says 400.000 d = 400k: code wins on a typed value.
        await expect(parts.service.checkSameMeaning(WS, [filed])).resolves.toEqual({
            judged: 1,
            flagged: 0,
            merged: 1,
            unsure: 0,
        })
        expect(parts.facts.mergeDuplicate).toHaveBeenCalledWith(WS, "new", "twin")
        expect(parts.facts.flagSameMeaning).not.toHaveBeenCalled()
    })
})

describe("FactEmbeddingsService: the same fact in other words: lists, a judge that says no, a cut judgement", () => {
    it("never closes a row of a list as a duplicate of another row of the same passage (P11 on dev: one value per flower)", async () => {
        const row = { kind: "document" as const, ref: "p11", label: "P11", quote: "| Hoa baby | mien phi |", sourceId: "p11", chunkHash: "list" }
        const baby = factOf({ ...filed, subjectKey: "hoa-baby", evidence: [row] })
        const vase = factOf({ ...sibling, id: "vase", subjectKey: "binh-hoa-de-ban", value: filed.value, evidence: [{ ...row, quote: "| Binh hoa de ban | mien phi |" }] })
        const parts = await scripted({ same: 1, sameValue: true })
        parts.vectors.nearestTo.mockResolvedValue([{ fact: vase, distance: 0.09 }])

        await expect(parts.service.checkSameMeaning(WS, [baby])).resolves.toMatchObject({ judged: 1, merged: 0, flagged: 0 })
        expect(parts.facts.mergeDuplicate).not.toHaveBeenCalled()
    })

    it("flags nothing when the judge says no candidate is the same truth", async () => {
        const { service, facts } = await scripted({ same: null })

        await expect(service.checkSameMeaning(WS, [filed])).resolves.toEqual({
            judged: 1,
            flagged: 0,
            merged: 0,
            unsure: 0,
        })
        expect(facts.flagSameMeaning).not.toHaveBeenCalled()
        expect(facts.mergeDuplicate).not.toHaveBeenCalled()
    })

    it("D-BR-3: a judgement cut by hidden reasoning is booked, tried again, and still cut is surfaced as a possible duplicate, never 'not the same'", async () => {
        const { service, ai, facts, usage } = await scripted()
        const cut = {
            ok: false as const,
            failure: "length" as const,
            spent: {
                model: "claude-haiku-5-5",
                usage: { promptTokens: 300, completionTokens: 200, totalTokens: 500, costUsd: 0, reasoningTokens: 187 },
                served: { upstream: "anthropic", finishReason: "max_tokens", durationMs: 2100 },
                cap: 1024,
            },
        }
        ai.attempt.mockResolvedValue(cut)

        await expect(service.checkSameMeaning(WS, [filed])).resolves.toEqual({
            judged: 1,
            flagged: 1,
            merged: 0,
            unsure: 1,
        })

        expect(ai.attempt).toHaveBeenCalledTimes(2)
        // D-N-13: the try after a cut verdict is not the same call again: it has twice the room.
        expect(ai.attempt.mock.calls.map(([request]) => request.budget)).toEqual([
            { effort: "high", maxTokens: 8000 },
            { effort: "high", maxTokens: 16_000 },
        ])
        expect(usage.record.mock.calls.map((call) => call[0]).filter((one) => one.kind === "brain")).toEqual([
            expect.objectContaining({
                kind: "brain",
                model: "claude-haiku-5-5",
                failure: "length",
                tryNumber: 1,
                usage: cut.spent.usage,
            }),
            expect.objectContaining({ kind: "brain", failure: "length", tryNumber: 2 }),
        ])
        // The nearest candidate (other key) is named for the founder.
        expect(facts.flagSameMeaning).toHaveBeenCalledWith(WS, "new", "sibling")
    })
})

describe("FactEmbeddingsService: the same fact in other words: unreadable answers and an index that did not answer", () => {
    it("tries again after an unreadable answer and takes the readable one", async () => {
        const { service, ai, facts } = await scripted()
        ai.attempt
            .mockResolvedValueOnce({ ok: false, failure: "empty" })
            .mockResolvedValueOnce(answeredWith({ same: null }))

        await expect(service.checkSameMeaning(WS, [filed])).resolves.toEqual({
            judged: 1,
            flagged: 0,
            merged: 0,
            unsure: 0,
        })
        expect(ai.attempt).toHaveBeenCalledTimes(2)
        expect(facts.flagSameMeaning).not.toHaveBeenCalled()
    })

    it("asks no model when no candidate is near, and checks only open proposals (never one that already disagrees)", async () => {
        const { service, ai, vectors } = await scripted()
        vectors.nearestTo.mockResolvedValue([])

        await expect(
            service.checkSameMeaning(WS, [
                filed,
                factOf({ id: "clash", status: "proposed", conflictWith: "active-1" }),
            ]),
        ).resolves.toEqual({ judged: 0, flagged: 0, merged: 0, unsure: 0 })
        expect(ai.attempt).not.toHaveBeenCalled()
        expect(vectors.statesOf).toHaveBeenCalledWith(WS, ["new"])
    })

    it("never takes 'the vector index did not answer' as 'a distinct truth': unchecked and logged, or UNKNOWN over its word candidates", async () => {
        const { service, ai, vectors, facts, logger, reads } = await scripted()
        vectors.nearestToRead.mockResolvedValue({ facts: [], indexDown: true })

        await expect(service.checkSameMeaning(WS, [filed])).resolves.toEqual({
            judged: 0,
            flagged: 0,
            merged: 0,
            unsure: 0,
            unchecked: 1,
        })
        expect(ai.attempt).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith(FactReadingLogEvent.SameMeaningIndexDown, {
            workspaceId: WS,
            factId: "new",
        })

        const byWords = factOf({ ...known, id: "by-words" })
        reads.wordHits.mockResolvedValue([byWords])
        await expect(service.checkSameMeaning(WS, [filed])).resolves.toMatchObject({ judged: 1, flagged: 1, unsure: 1 })
        expect(facts.flagSameMeaning).toHaveBeenCalledWith(WS, "new", "by-words")
    })
})

describe("FactEmbeddingsService: the same fact in other words: the window's own facts and an empty pool", () => {
    it("leaves the window's own facts out of the candidates", async () => {
        const { service, vectors, reads } = await scripted()
        vectors.nearestTo.mockResolvedValue([{ fact: { ...known, id: "twin" }, distance: 0.01 }])
        reads.wordHits.mockResolvedValue([factOf({ ...known, id: "twin" })])

        await expect(
            service.checkSameMeaning(WS, [filed, factOf({ ...known, id: "twin", status: "proposed" })]),
        ).resolves.toEqual({ judged: 0, flagged: 0, merged: 0, unsure: 0 })
    })

    it("spends nothing without credits, and never throws", async () => {
        const blocked = await scripted()
        // The pool is read before the vector batch (embedding, bulk) too: open there, empty when the judge would be asked.
        blocked.usage.blockedBy.mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(true)
        await expect(blocked.service.checkSameMeaning(WS, [filed])).resolves.toEqual({
            judged: 0,
            flagged: 0,
            merged: 0,
            unsure: 0,
        })
        expect(blocked.ai.attempt).not.toHaveBeenCalled()

        const failing = await scripted()
        const cause = new Error("db")
        failing.vectors.nearestTo.mockRejectedValue(cause)
        await expect(failing.service.checkSameMeaning(WS, [filed])).resolves.toEqual({
            judged: 0,
            flagged: 0,
            merged: 0,
            unsure: 0,
        })
        expect(failing.logger.error).toHaveBeenCalledWith(FactReadingLogEvent.SameMeaningFailed, cause, {
            workspaceId: WS,
        })
    })
})

/** The live pair: different facts 0.162 apart on text-embedding-3-small. */
const outer = factOf({
    id: "outer",
    status: "proposed",
    subjectKey: "giao-hang-ngoai-thanh",
    subjectLabel: "Giao h\u00e0ng ngo\u1ea1i th\u00e0nh",
    attribute: "phi-giao-hang",
    attributeLabel: "Ph\u00ed giao h\u00e0ng",
    value: "60.000 \u0111",
    unit: null,
})
const inner = factOf({
    id: "inner",
    subjectKey: "giao-hang-noi-thanh",
    subjectLabel: "Giao h\u00e0ng n\u1ed9i th\u00e0nh",
    attribute: "phi-giao-hang",
    attributeLabel: "Ph\u00ed giao h\u00e0ng",
    value: "30.000 \u0111",
    unit: null,
})

const world = async (answer: SameAnswer) => {
    const parts = await build([])
    parts.vectors.statesOf.mockResolvedValue([])
    parts.vectors.nearestTo.mockResolvedValue([{ fact: inner, distance: 0.162 }])
    parts.usage.blockedBy.mockResolvedValue(false)
    parts.ai.attempt.mockResolvedValue({
        ok: true,
        answer: {
            text: JSON.stringify(answer),
            model: "work",
            usage: { promptTokens: 60, completionTokens: 5, totalTokens: 65, costUsd: 0 },
            parsed: null,
            retrieved: 0,
            served: { upstream: "anthropic", finishReason: "end_turn", durationMs: 500 },
        },
    })
    parts.json.jsonOf.mockReturnValue(answer)
    return parts
}


describe("FactEmbeddingsService: a near vector is never the same fact by itself (BR1, recorded case P11 G4)", () => {
    it("the change card's candidate: the judgement says the outer-city fee is not the inner-city fee, so nothing is offered to replace", async () => {
        const { service, ai, usage } = await world({ same: null })

        await expect(service.nearestInForce(WS, outer)).resolves.toBeNull()

        expect(ai.attempt).toHaveBeenCalledTimes(1)
        expect(ai.attempt.mock.calls[0]?.[0].messages[1]?.content).toContain(
            "1. Giao h\u00e0ng n\u1ed9i th\u00e0nh - Ph\u00ed giao h\u00e0ng: 30.000 \u0111",
        )
        expect(usage.record).toHaveBeenCalledWith(expect.objectContaining({ kind: "brain" }))
    })

    it("offers the candidate only when the judgement names it, among the nearest truths in force", async () => {
        const { service, vectors } = await world({ same: 1 })

        await expect(service.nearestInForce(WS, outer)).resolves.toBe(inner)
        expect(vectors.nearestTo.mock.calls[0]?.[3]).toEqual(
            expect.objectContaining({ statuses: ["active"], maxDistance: 0.45, limit: 8 }),
        )
    })

    it("offers the nearest truth for the founder to confirm when the judgement stays unreadable (never 'nothing to replace')", async () => {
        const { service, ai } = await world({ same: 1 })
        ai.attempt.mockResolvedValue({ ok: false, failure: "length" })

        await expect(service.nearestInForce(WS, outer)).resolves.toBe(inner)
        expect(ai.attempt).toHaveBeenCalledTimes(2)
    })
})

describe("FactEmbeddingsService: a near vector is never the same fact by itself: no fact near, other numbers", () => {
    it("asks nothing and offers nothing when no fact is near, or the brain budget is spent", async () => {
        const none = await world({ same: 1 })
        none.vectors.nearestTo.mockResolvedValue([])
        await expect(none.service.nearestInForce(WS, outer)).resolves.toBeNull()
        expect(none.ai.attempt).not.toHaveBeenCalled()

        const spent = await world({ same: 1 })
        spent.usage.blockedBy.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
        await expect(spent.service.nearestInForce(WS, outer)).resolves.toBeNull()
        expect(spent.ai.attempt).not.toHaveBeenCalled()
    })

    it("shows the change card's judge a fact whose labels name other numbers (10 vs 20 roses): the judge says it is another item", async () => {
        const { service, ai, vectors } = await world({ same: null })
        const ten = factOf({
            id: "ten",
            status: "proposed",
            subjectKey: "bo-hong-10",
            subjectLabel: "B\u00f3 h\u1ed3ng 10 b\u00f4ng",
            attribute: "gia",
            attributeLabel: "Gi\u00e1",
        })
        const twenty = factOf({
            id: "twenty",
            subjectKey: "bo-hong-20",
            subjectLabel: "B\u00f3 hoa h\u1ed3ng 20 b\u00f4ng",
            attribute: "gia",
            attributeLabel: "Gi\u00e1",
        })
        vectors.nearestTo.mockResolvedValue([{ fact: twenty, distance: 0.05 }])

        await expect(service.nearestInForce(WS, ten)).resolves.toBeNull()
        expect(ai.attempt).toHaveBeenCalledTimes(1)
        expect(ai.attempt.mock.calls[0]?.[0].messages[1]?.content).toContain("1. B\u00f3 hoa h\u1ed3ng 20 b\u00f4ng")
    })
})

describe("FactEmbeddingsService: the same KEY in another wording is read by the judge, never by a word list", () => {
    /** A laundry's express fee in force, and a document that states it again with what it is charged for. */
    const inForce = factOf({
        id: "fee",
        status: "active",
        subjectKey: "express-wash",
        subjectLabel: "Express wash",
        attribute: "fee",
        attributeLabel: "Fee",
        value: "30.000 \u0111",
        unit: null,
    })
    const reworded = factOf({ ...inForce, id: "again", status: "proposed", value: "30k per basket", conflictWith: "fee" })

    it("a truth the store linked to another value of its own key, worded so code cannot compare it, has that ONE pair read: the same value joins it and nothing is asked", async () => {
        const parts = await scripted({ same: 1, sameValue: true })
        parts.reads.byIds.mockResolvedValue([inForce])

        await expect(parts.service.checkSameMeaning(WS, [reworded])).resolves.toMatchObject({ judged: 1, merged: 1, flagged: 0 })

        expect(parts.reads.byIds).toHaveBeenCalledWith(WS, ["fee"])
        expect(parts.ai.attempt).toHaveBeenCalledTimes(1)
        expect(parts.facts.mergeDuplicate).toHaveBeenCalledWith(WS, "again", "fee")
        expect(parts.facts.flagSameMeaning).not.toHaveBeenCalled()
    })

    it("the judge reads another value, or gives no readable answer: the store's link stands (the founder is asked), nothing is merged", async () => {
        for (const verdict of [{ same: 1, sameValue: false }, { same: null }, { nonsense: true }]) {
            const parts = await scripted(verdict)
            parts.reads.byIds.mockResolvedValue([inForce])

            await parts.service.checkSameMeaning(WS, [reworded])

            expect(parts.facts.mergeDuplicate).not.toHaveBeenCalled()
            expect(parts.facts.flagSameMeaning).not.toHaveBeenCalled()
        }
    })

    it("asks no model when code can compare the two values (two bare amounts differ: a contradiction as filed), nor for another key or another agent", async () => {
        const parts = await scripted({ same: 1, sameValue: true })
        const dearer = factOf({ ...reworded, id: "dearer", value: "35.000 \u0111" })
        const elsewhere = factOf({ ...reworded, id: "elsewhere", subjectKey: "slow-wash" })
        const oneAgent = factOf({ ...reworded, id: "one-agent", installationId: "11111111-1111-4111-8111-111111111111" })
        parts.reads.byIds.mockResolvedValue([inForce])

        await expect(parts.service.checkSameMeaning(WS, [dearer, elsewhere, oneAgent])).resolves.toEqual({
            judged: 0,
            flagged: 0,
            merged: 0,
            unsure: 0,
        })
        expect(parts.ai.attempt).not.toHaveBeenCalled()
    })
})

describe("FactEmbeddingsService: the same fact in other words: scheduled truths, periods and the source sentences (Round W)", () => {
    /** Three days of February, as two documents state them. */
    const WINDOW = { validFrom: "2027-02-11T17:00:00.000Z", validTo: "2027-02-14T17:00:00.000Z" }
    const quoted = (sourceId: string, title: string, quote: string) => ({ kind: "document" as const, ref: sourceId, sourceId, label: title, title, quote, chunkHash: `h-${sourceId}` })

    it("D-W-2: the same dated window stated by a second document joins the SCHEDULED truth: one truth, nothing asked", async () => {
        const again = factOf({ ...filed, id: "again", subjectKey: "phu-thu-le", ...WINDOW })
        const scheduled = factOf({ ...known, id: "scheduled", status: "scheduled", value: "400k", ...WINDOW })
        const parts = await scripted({ same: 1, sameValue: true, sameScope: true })
        parts.vectors.statesOf.mockResolvedValue([{ fact: again, stored: { model: null, dimensions: null, hash: null } }])
        parts.vectors.nearestTo.mockResolvedValue([{ fact: scheduled, distance: 0.07 }])
        parts.facts.mergeDuplicate.mockResolvedValue(scheduled)

        await expect(parts.service.checkSameMeaning(WS, [again])).resolves.toMatchObject({ judged: 1, merged: 1, flagged: 0 })

        expect(parts.vectors.nearestTo.mock.calls[0]?.[3]).toEqual(expect.objectContaining({ statuses: ["active", "scheduled", "proposed"] }))
        expect(parts.facts.mergeDuplicate).toHaveBeenCalledWith(WS, "again", "scheduled")
        expect(parts.facts.flagSameMeaning).not.toHaveBeenCalled()
    })

    it("offers a scheduled truth the word leg found, never a waiting one (a waiting line is found by its vector)", async () => {
        const parts = await scripted({ same: null })
        const scheduled = factOf({ ...known, id: "by-words-scheduled", status: "scheduled", subjectKey: "phu-thu" })
        const waiting = factOf({ ...known, id: "by-words-waiting", status: "proposed", subjectKey: "phu-thu-2" })
        parts.vectors.nearestTo.mockResolvedValue([])
        parts.reads.wordHits.mockResolvedValue([scheduled, waiting])

        await parts.service.checkSameMeaning(WS, [filed])

        const asked = String(parts.ai.attempt.mock.calls[0]?.[0].messages[1]?.content)
        expect(asked.split("\n").filter((line) => /^\d+\. /u.test(line))).toHaveLength(1)
    })

    it("a dated window over the standing value keeps its link (the settle reads it as the overlay); a standing value after a scheduled window is linked to nothing", async () => {
        const windowFee = factOf({ ...filed, id: "window-fee", value: "500.000 \u0111", ...WINDOW })
        const over = await scripted({ same: 1, sameValue: false, sameScope: true })
        over.vectors.statesOf.mockResolvedValue([{ fact: windowFee, stored: { model: null, dimensions: null, hash: null } }])
        over.vectors.nearestTo.mockResolvedValue([{ fact: known, distance: 0.07 }])

        await expect(over.service.checkSameMeaning(WS, [windowFee])).resolves.toMatchObject({ judged: 1, merged: 0, flagged: 1 })
        expect(over.facts.flagSameMeaning).toHaveBeenCalledWith(WS, "window-fee", "known")

        const scheduledWindow = factOf({ ...known, id: "scheduled-window", status: "scheduled", value: "500.000 \u0111", ...WINDOW })
        const after = await scripted({ same: 1, sameValue: false, sameScope: true })
        after.vectors.nearestTo.mockResolvedValue([{ fact: scheduledWindow, distance: 0.07 }])

        await expect(after.service.checkSameMeaning(WS, [filed])).resolves.toMatchObject({ judged: 1, merged: 0, flagged: 0 })
        expect(after.facts.flagSameMeaning).not.toHaveBeenCalled()
        expect(after.facts.mergeDuplicate).not.toHaveBeenCalled()
    })

    it("an unreadable verdict is surfaced with the nearest candidate that holds at the same time, never one of another period", async () => {
        const windowTruth = factOf({ ...known, id: "window-truth", status: "scheduled", subjectKey: "phu-thu", ...WINDOW })
        const parts = await scripted({ nonsense: true })
        parts.vectors.nearestTo.mockResolvedValue([
            { fact: windowTruth, distance: 0.03 },
            { fact: known, distance: 0.08 },
        ])

        await expect(parts.service.checkSameMeaning(WS, [filed])).resolves.toMatchObject({ judged: 1, flagged: 1, unsure: 1 })

        expect(parts.facts.flagSameMeaning).toHaveBeenCalledWith(WS, "new", "known")
    })

    it("D-W-1: shows the judge the sentence and the document each truth was read from, across the two areas", async () => {
        const internalLine = factOf({ ...filed, id: "internal-line", scope: "internal", evidence: [quoted("k1", "Update notice", "The birthday voucher for loyal customers is 100.000.")] })
        const publicTruth = factOf({ ...known, id: "public-truth", scope: "public", evidence: [quoted("p05", "Loyalty programme", "Members from Silver get a birthday voucher of 50.000.")] })
        const parts = await scripted({ same: 1, sameValue: false, sameScope: true })
        parts.vectors.statesOf.mockResolvedValue([{ fact: internalLine, stored: { model: null, dimensions: null, hash: null } }])
        parts.vectors.nearestTo.mockResolvedValue([{ fact: publicTruth, distance: 0.12 }])

        await expect(parts.service.checkSameMeaning(WS, [internalLine])).resolves.toMatchObject({ judged: 1, flagged: 1 })

        const asked = String(parts.ai.attempt.mock.calls[0]?.[0].messages[1]?.content)
        expect(asked).toContain('   written as: "The birthday voucher for loyal customers is 100.000." (document: "Update notice")')
        expect(asked).toContain('   written as: "Members from Silver get a birthday voucher of 50.000." (document: "Loyalty programme")')
        // The internal value against the public value of the same thing is a question for the founder, never two values in force.
        expect(parts.facts.flagSameMeaning).toHaveBeenCalledWith(WS, "internal-line", "public-truth")
    })
})
