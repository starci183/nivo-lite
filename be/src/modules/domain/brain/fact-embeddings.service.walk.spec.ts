import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { BrainFactEmbeddingsService, BrainFactsReadService, BrainFactsService } from "@modules/domain/brain-facts"
import type { FactEmbeddingState } from "@modules/domain/brain-facts"
import { UsageMeterService } from "@modules/domain/knowledge"
import { AI } from "@modules/integrations/ai"
import type { AiService } from "@modules/integrations/ai"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { VectorSyncService } from "@modules/domain/vector-sync"
import { FactEmbeddingsService } from "./fact-embeddings.service"
import { ModelJsonService } from "./model-json.service"
import { JUDGE_DISTANCE_CAP } from "./same-fact.policy"
import { EMBEDDING_PAIR_CASES, EMBEDDING_WS, embeddingLineOf, parsedJsonOf, scriptEmbeddingDoubles } from "@tests/fixtures/builders/brain-embeddings.builder"

const WS = EMBEDDING_WS
const parsedJson = parsedJsonOf
const line = embeddingLineOf
const cases = EMBEDDING_PAIR_CASES

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


describe("FactEmbeddingsService: the walk's missed pairs reach the judge and get the right verdict (D-BR-8, D-BR-9; RESULTS-R1R2 \u00a72)", () => {
    it.each(cases)("%s", async (_name, filed, other, distance, verdict, outcome) => {
        expect(distance).toBeLessThan(JUDGE_DISTANCE_CAP)
        const parts = await build([])
        parts.vectors.statesOf.mockResolvedValue([])
        parts.usage.blockedBy.mockResolvedValue(false)
        // The database answers what lies under the cap the service asks for.
        parts.vectors.nearestTo.mockImplementation((_ws, _id, _identity, options) =>
            Promise.resolve(distance < options.maxDistance ? [{ fact: other, distance }] : []),
        )
        parts.ai.attempt.mockResolvedValue({
            ok: true,
            answer: {
                text: JSON.stringify(verdict),
                parsed: null,
                model: "work",
                usage: { promptTokens: 300, completionTokens: 150, totalTokens: 450, costUsd: 0 },
                retrieved: 0,
                served: { upstream: "anthropic", finishReason: "end_turn", durationMs: 800 },
            },
        })
        parts.json.jsonOf.mockImplementation(parsedJson)
        parts.facts.flagSameMeaning.mockResolvedValue(true)
        parts.facts.mergeDuplicate.mockResolvedValue(other)

        const done = await parts.service.checkSameMeaning(WS, [filed])

        expect(parts.ai.attempt).toHaveBeenCalledTimes(1)
        if (outcome === "contradiction") {
            expect(done).toMatchObject({ judged: 1, flagged: 1, merged: 0 })
            expect(parts.facts.flagSameMeaning).toHaveBeenCalledWith(WS, filed.id, other.id)
        } else {
            expect(done).toMatchObject({ judged: 1, flagged: 0, merged: 1 })
            expect(parts.facts.mergeDuplicate).toHaveBeenCalledWith(WS, filed.id, other.id)
        }
    })

    it("shows the judge the near-misses too: chi nh\u00e1nh 1 vs chi nh\u00e1nh 2 hours reach it and it keeps them apart (N03, 0.178)", async () => {
        const parts = await build([])
        parts.vectors.statesOf.mockResolvedValue([])
        parts.usage.blockedBy.mockResolvedValue(false)
        const two = line(
            "2b60fdf1",
            "Chi nh\u00e1nh 2 (Th\u1ee7 \u0110\u1ee9c)",
            "gi\u1edd m\u1edf c\u1eeda th\u1ee9 Hai \u0111\u1ebfn th\u1ee9 S\u00e1u",
            "8:00 \u2013 20:30",
            "proposed",
        )
        const one = line(
            "b9b1a41b",
            "Chi nh\u00e1nh 1",
            "gi\u1edd m\u1edf c\u1eeda th\u1ee9 Hai \u0111\u1ebfn th\u1ee9 S\u00e1u",
            "7:30 \u2013 21:00",
            "active",
        )
        parts.vectors.nearestTo.mockResolvedValue([{ fact: one, distance: 0.178 }])
        // The labels name other branches: no code filter hides the pair any more; the judge reads the condition and says "different".
        parts.ai.attempt.mockResolvedValue({
            ok: true,
            answer: {
                text: JSON.stringify({ same: null }),
                parsed: null,
                model: "work",
                usage: { promptTokens: 300, completionTokens: 20, totalTokens: 320, costUsd: 0 },
                retrieved: 0,
                served: { upstream: "anthropic", finishReason: "end_turn", durationMs: 600 },
            },
        })
        parts.json.jsonOf.mockImplementation(parsedJson)

        await expect(parts.service.checkSameMeaning(WS, [two])).resolves.toMatchObject({ judged: 1, flagged: 0, merged: 0 })
        expect(parts.ai.attempt).toHaveBeenCalledTimes(1)
        expect(parts.facts.flagSameMeaning).not.toHaveBeenCalled()
        expect(parts.facts.mergeDuplicate).not.toHaveBeenCalled()
    })
})
