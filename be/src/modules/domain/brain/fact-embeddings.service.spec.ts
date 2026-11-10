import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { BrainFactEmbeddingsService, BrainFactsService, factEmbedHashOf } from "@modules/domain/brain-facts"
import type { FactEmbeddingState, FactRecord } from "@modules/domain/brain-facts"
import { UsageMeterService } from "@modules/domain/knowledge"
import { EMBEDDING_DIMENSIONS } from "@modules/domain/knowledge-chunks"
import { AI } from "@modules/integrations/ai"
import type { AiService } from "@modules/integrations/ai"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BrainLogEvent } from "./brain.log-events"
import { FactEmbeddingsService } from "./fact-embeddings.service"
import { FactReadingLogEvent } from "./fact-reading.log-events"
import { ModelJsonService } from "./model-json.service"
import { SAME_FACT_PROMPT } from "./same-fact.policy"

const WS = "ws-1"
const PROFILE = "embed"

const factOf = builder<FactRecord>({
    id: "f1",
    subjectType: "business",
    subjectKey: "phi-ship",
    subjectLabel: "Phi ship",
    attribute: "noi-thanh",
    attributeLabel: "noi thanh",
    value: "30.000",
    valueNumber: 30000,
    unit: "d",
    scope: "internal",
    modules: [],
    installationId: null,
    status: "active",
    sourceKind: "owner",
    trust: 95,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "Ada",
    proposedAt: "2026-11-10T00:00:00.000Z",
    decidedBy: "Ada",
    decidedAt: "2026-11-10T00:00:00.000Z",
    decisionNote: null,
})

const vector = (seed: number): ReadonlyArray<number> => Array.from({ length: EMBEDDING_DIMENSIONS }, () => seed)

const build = async (states: ReadonlyArray<FactEmbeddingState>) => {
    const ai = mock<AiService>()
    const logger = mock<Logger>()
    const usage = mock<UsageMeterService>()
    const vectors = mock<BrainFactEmbeddingsService>()
    const facts = mock<BrainFactsService>()
    const json = mock<ModelJsonService>()
    ai.available.mockReturnValue(true)
    ai.embeddingModel.mockReturnValue(PROFILE)
    vectors.inForce.mockResolvedValue(states)
    const moduleRef = await Test.createTestingModule({
        providers: [
            FactEmbeddingsService,
            { provide: AI, useValue: ai },
            { provide: LOGGER, useValue: logger },
            { provide: UsageMeterService, useValue: usage },
            { provide: BrainFactEmbeddingsService, useValue: vectors },
            { provide: BrainFactsService, useValue: facts },
            { provide: ModelJsonService, useValue: json },
        ],
    }).compile()
    return { service: moduleRef.get(FactEmbeddingsService), ai, logger, usage, vectors, facts, json }
}

describe("FactEmbeddingsService: the truth graph embeds through the one door, never twice for the same line", () => {
    const current = factOf({ id: "same" })
    const changed = factOf({ id: "changed", value: "35.000" })
    const oldIdentity = factOf({ id: "old-profile" })
    const fresh = factOf({ id: "fresh" })
    const currentState: FactEmbeddingState = {
        fact: current,
        stored: { model: PROFILE, dimensions: EMBEDDING_DIMENSIONS, hash: factEmbedHashOf(current) },
    }
    const states: ReadonlyArray<FactEmbeddingState> = [
        currentState,
        { fact: changed, stored: { model: PROFILE, dimensions: EMBEDDING_DIMENSIONS, hash: factEmbedHashOf(current) } },
        { fact: oldIdentity, stored: { model: "embed-v0", dimensions: EMBEDDING_DIMENSIONS, hash: factEmbedHashOf(oldIdentity) } },
        { fact: fresh, stored: { model: null, dimensions: null, hash: null } },
    ]

    it("sends only the changed, re-indexed and new lines, records the identity and hash of each, and meters the call", async () => {
        const { service, ai, usage, vectors } = await build(states)
        ai.embed.mockResolvedValue({ vectors: [vector(1), vector(2), vector(3)], usage: null })

        await expect(service.refresh(WS)).resolves.toEqual({ embedded: 3, unchanged: 1 })

        expect(ai.embed).toHaveBeenCalledTimes(1)
        expect(ai.embed.mock.calls[0]?.[0]).toEqual({
            input: ["Phi ship - noi thanh: 35.000 d", "Phi ship - noi thanh: 30.000 d", "Phi ship - noi thanh: 30.000 d"],
            dimensions: EMBEDDING_DIMENSIONS,
            timeoutMs: 20_000,
        })
        const identity = { model: PROFILE, dimensions: EMBEDDING_DIMENSIONS }
        expect(vectors.store.mock.calls).toEqual([
            [WS, "changed", vector(1), identity, factEmbedHashOf(changed)],
            [WS, "old-profile", vector(2), identity, factEmbedHashOf(oldIdentity)],
            [WS, "fresh", vector(3), identity, factEmbedHashOf(fresh)],
        ])
        expect(usage.record).toHaveBeenCalledWith(
            expect.objectContaining({ workspaceId: WS, kind: "embedding", model: PROFILE }),
        )
    })

    it("calls nothing when every line is current", async () => {
        const { service, ai } = await build([currentState])

        await expect(service.refresh(WS)).resolves.toEqual({ embedded: 0, unchanged: 1 })
        expect(ai.embed).not.toHaveBeenCalled()
    })

    it("stores nothing when the answer has the wrong count or size: never a vector of another shape", async () => {
        const { service, ai, vectors } = await build(states)
        ai.embed.mockResolvedValue({ vectors: [[1, 2, 3]], usage: null })

        await expect(service.refresh(WS)).resolves.toEqual({ embedded: 0, unchanged: 1 })
        expect(vectors.store).not.toHaveBeenCalled()
    })

    it("does nothing without an AI key, and logs a failure without throwing", async () => {
        const off = await build(states)
        off.ai.available.mockReturnValue(false)
        await expect(off.service.refresh(WS)).resolves.toEqual({ embedded: 0, unchanged: 0 })
        expect(off.vectors.inForce).not.toHaveBeenCalled()

        const failing = await build(states)
        const cause = new Error("db")
        failing.vectors.inForce.mockRejectedValue(cause)
        await expect(failing.service.refresh(WS)).resolves.toEqual({ embedded: 0, unchanged: 0 })
        expect(failing.logger.error).toHaveBeenCalledWith(BrainLogEvent.EmbeddingsFailed, cause, { workspaceId: WS })
    })

    it("names its identity from config (the AI profile) and the stored column's dimensions", async () => {
        const { service } = await build([])

        expect(service.identity()).toEqual({ model: PROFILE, dimensions: EMBEDDING_DIMENSIONS })
    })
})

describe("FactEmbeddingsService: batches of 32 lines", () => {
    it("sends 40 changed lines in two calls", async () => {
        const many: ReadonlyArray<FactEmbeddingState> = Array.from({ length: 40 }, (_, index) => ({
            fact: factOf({ id: `f${index}`, value: `${index}.000` }),
            stored: { model: null, dimensions: null, hash: null },
        }))
        const { service, ai } = await build(many)
        ai.embed.mockImplementation((request) => Promise.resolve({ vectors: request.input.map(() => vector(1)), usage: null }))

        await expect(service.refresh(WS)).resolves.toEqual({ embedded: 40, unchanged: 0 })
        expect(ai.embed.mock.calls.map((call) => call[0].input.length)).toEqual([32, 8])
    })
})

describe("FactEmbeddingsService: the same fact in other words (BG2 P4b), scripted vectors and judgement", () => {
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

    const scripted = async () => {
        const parts = await build([])
        parts.vectors.statesOf.mockResolvedValue([unembedded])
        parts.ai.embed.mockResolvedValue({ vectors: [vector(7)], usage: null })
        parts.vectors.nearestTo.mockResolvedValue([
            { fact: sameKey, distance: 0.02 },
            { fact: sibling, distance: 0.05 },
            { fact: known, distance: 0.08 },
        ])
        parts.usage.blockedBy.mockResolvedValue(false)
        parts.ai.chat.mockResolvedValue({ text: '{"same": 1}', model: "work", usage: { promptTokens: 60, completionTokens: 5, totalTokens: 65, costUsd: 0 }, parsed: null, retrieved: 0 })
        parts.json.jsonOf.mockReturnValue({ same: 1 })
        parts.facts.flagSameMeaning.mockResolvedValue(true)
        return parts
    }

    it("embeds the new proposal once (stored, so its approval sends nothing), reads candidates by its own vector, other keys only", async () => {
        const { service, ai, vectors } = await scripted()

        const found = await service.nearMeaning(WS, [filed], { excludeIds: ["sibling"] })

        expect(ai.embed).toHaveBeenCalledTimes(1)
        expect(vectors.store.mock.calls.map((call) => call.slice(0, 2))).toEqual([[WS, "new"]])
        expect(vectors.nearestTo.mock.calls[0]?.slice(1)).toEqual([
            "new",
            { model: PROFILE, dimensions: EMBEDDING_DIMENSIONS },
            { statuses: ["active", "proposed"], installationId: null, maxDistance: 0.25, limit: 7 },
        ])
        expect(found.map(({ fact, near }) => [fact.id, near.map((hit) => hit.fact.id)])).toEqual([["new", ["known"]]])
    })

    it("asks ONE cheap judgement for a fact with a near candidate and flags it for the founder; nothing is merged", async () => {
        const { service, ai, facts, usage, logger } = await scripted()

        await expect(service.checkSameMeaning(WS, [filed])).resolves.toEqual({ judged: 1, flagged: 1 })

        expect(ai.chat).toHaveBeenCalledTimes(1)
        expect(ai.chat.mock.calls[0]?.[0]).toMatchObject({
            messages: [
                { role: "system", content: SAME_FACT_PROMPT },
                {
                    role: "user",
                    content: "NEW: B\u00f3 h\u1ed3ng \u0111\u1ecf 10 b\u00f4ng - Gi\u00e1: 400.000 \u0111\nKNOWN:\n1. B\u00f3 hoa h\u1ed3ng \u0111\u1ecf 10 b\u00f4ng - Gi\u00e1: 350.000 \u0111\n2. B\u00f3 hoa h\u1ed3ng \u0111\u1ecf 10 b\u00f4ng - Gi\u00e1: 350.000 \u0111",
                },
            ],
            budget: { effort: "off", maxTokens: 200 },
        })
        expect(facts.flagSameMeaning).toHaveBeenCalledWith(WS, "new", "sibling")
        expect(usage.record).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: WS, kind: "brain" }))
        expect(logger.info).toHaveBeenCalledWith(FactReadingLogEvent.SameMeaningChecked, { workspaceId: WS, judged: 1, flagged: 1 })
    })

    it("flags nothing when the model says none, or names a candidate out of range", async () => {
        const { service, facts, json } = await scripted()
        json.jsonOf.mockReturnValueOnce({ same: null }).mockReturnValueOnce({ same: 4 })

        await expect(service.checkSameMeaning(WS, [filed])).resolves.toEqual({ judged: 1, flagged: 0 })
        await expect(service.checkSameMeaning(WS, [filed])).resolves.toEqual({ judged: 1, flagged: 0 })
        expect(facts.flagSameMeaning).not.toHaveBeenCalled()
    })

    it("asks no model when no candidate is near, and checks only open proposals (never one that already disagrees)", async () => {
        const { service, ai, vectors } = await scripted()
        vectors.nearestTo.mockResolvedValue([])

        await expect(
            service.checkSameMeaning(WS, [filed, factOf({ id: "clash", status: "proposed", conflictWith: "active-1" })]),
        ).resolves.toEqual({ judged: 0, flagged: 0 })
        expect(ai.chat).not.toHaveBeenCalled()
        expect(vectors.statesOf).toHaveBeenCalledWith(WS, ["new"])
    })

    it("leaves the window's own facts out of the candidates", async () => {
        const { service, vectors } = await scripted()
        vectors.nearestTo.mockResolvedValue([{ fact: { ...known, id: "twin" }, distance: 0.01 }])

        await expect(service.checkSameMeaning(WS, [filed, factOf({ ...known, id: "twin", status: "proposed" })])).resolves.toEqual({
            judged: 0,
            flagged: 0,
        })
    })

    it("spends nothing without credits, and never throws", async () => {
        const blocked = await scripted()
        blocked.usage.blockedBy.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
        await expect(blocked.service.checkSameMeaning(WS, [filed])).resolves.toEqual({ judged: 0, flagged: 0 })
        expect(blocked.ai.chat).not.toHaveBeenCalled()

        const failing = await scripted()
        const cause = new Error("db")
        failing.vectors.nearestTo.mockRejectedValue(cause)
        await expect(failing.service.checkSameMeaning(WS, [filed])).resolves.toEqual({ judged: 0, flagged: 0 })
        expect(failing.logger.error).toHaveBeenCalledWith(FactReadingLogEvent.SameMeaningFailed, cause, { workspaceId: WS })
    })
})
