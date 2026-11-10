import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { BrainFactEmbeddingsService, factEmbedHashOf } from "@modules/domain/brain-facts"
import type { FactEmbeddingState, FactRecord } from "@modules/domain/brain-facts"
import { UsageMeterService } from "@modules/domain/knowledge"
import { EMBEDDING_DIMENSIONS } from "@modules/domain/knowledge-chunks"
import { AI } from "@modules/integrations/ai"
import type { AiService } from "@modules/integrations/ai"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BrainLogEvent } from "./brain.log-events"
import { FactEmbeddingsService } from "./fact-embeddings.service"

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
        ],
    }).compile()
    return { service: moduleRef.get(FactEmbeddingsService), ai, logger, usage, vectors }
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
