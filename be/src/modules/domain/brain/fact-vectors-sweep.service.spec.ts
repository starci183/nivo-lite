import * as facts from "@tests/fixtures/builders/brain-facts.builder"

import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { BrainFactEmbeddingsService, BrainFactsReadService, BrainFactsService } from "@modules/domain/brain-facts"
import type { FactEmbeddingState, FactRecord, WantingPage } from "@modules/domain/brain-facts"
import { UsageMeterService } from "@modules/domain/knowledge"
import { EMBEDDING_DIMENSIONS } from "@modules/domain/knowledge-chunks"
import { AI } from "@modules/integrations/ai"
import type { AiService } from "@modules/integrations/ai"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BrainLogEvent } from "./brain.log-events"
import { FactEmbeddingsService } from "./fact-embeddings.service"
import { FactVectorsSweepService } from "./fact-vectors-sweep.service"
import { ModelJsonService } from "./model-json.service"

const WS = facts.WS
const NONE = { model: null, dimensions: null, hash: null }

/** N facts in force with no vector, ids in keyset order. */
const inForceOf = (count: number): ReadonlyArray<FactRecord> =>
    Array.from({ length: count }, (_, index) =>
        facts.factOf({ id: `f${String(index).padStart(5, "0")}`, status: "active", value: `${String(index)}.000` }),
    )

/** The page a keyset read answers over these rows: the arm's rows after the cursor not yet embedded, at most `limit`. */
const pageOf = (
    rows: ReadonlyArray<FactRecord>,
    done: ReadonlySet<string>,
    page: WantingPage,
): ReadonlyArray<FactEmbeddingState> =>
    page.arm === "missing"
        ? rows
              .filter((fact) => !done.has(fact.id) && (page.afterId === null || fact.id > page.afterId))
              .slice(0, page.limit)
              .map((fact) => ({ fact, stored: NONE }))
        : []

/**
 * The sweep over a REAL `FactEmbeddingsService` (the one embedding loop) and a scripted store of N facts in force with no vector, whose
 * reads answer like the keyset index would and whose batched writes mark the facts done.
 */
const world = async (count: number) => {
    const ai = mock<AiService>()
    const logger = mock<Logger>()
    const vectors = mock<BrainFactEmbeddingsService>()
    const rows = inForceOf(count)
    const embedded = new Set<string>()
    ai.available.mockReturnValue(true)
    ai.embeddingModel.mockReturnValue("embed")
    ai.embed.mockImplementation((request) =>
        Promise.resolve({
            vectors: request.input.map(() => Array.from({ length: EMBEDDING_DIMENSIONS }, () => 1)),
            usage: null,
        }),
    )
    vectors.adopt.mockResolvedValue(new Set())
    vectors.wanting.mockImplementation((_ws, _identity, page) => Promise.resolve(pageOf(rows, embedded, page)))
    vectors.workspacesWanting.mockImplementation(() =>
        Promise.resolve(rows.some((fact) => !embedded.has(fact.id)) ? [WS] : []),
    )
    vectors.storeMany.mockImplementation((_ws, written) => {
        written.forEach((one) => embedded.add(one.id))
        return Promise.resolve()
    })
    const usage = mock<UsageMeterService>()
    usage.blockedBy.mockResolvedValue(false)
    const moduleRef = await Test.createTestingModule({
        providers: [
            FactVectorsSweepService,
            FactEmbeddingsService,
            { provide: AI, useValue: ai },
            { provide: LOGGER, useValue: logger },
            { provide: UsageMeterService, useValue: usage },
            { provide: BrainFactEmbeddingsService, useValue: vectors },
            { provide: BrainFactsService, useValue: mock<BrainFactsService>() },
            { provide: BrainFactsReadService, useValue: mock<BrainFactsReadService>() },
            { provide: ModelJsonService, useValue: mock<ModelJsonService>() },
        ],
    }).compile()
    return { service: moduleRef.get(FactVectorsSweepService), ai, logger, vectors, embedded, usage }
}

describe("FactVectorsSweepService at scale: 2,000 facts in force with no vector (a document applied in bulk)", () => {
    it("two ticks give every fact its vector: 17 page reads, 63 embedding calls, 63 writes; a third tick reads one row", async () => {
        const { service, vectors, ai, embedded, logger } = await world(2000)

        await expect(service.sweep()).resolves.toEqual({ workspaces: 1, embedded: 1024, copied: 0, more: 1 })
        await expect(service.sweep()).resolves.toEqual({ workspaces: 1, embedded: 976, copied: 0, more: 0 })

        expect(embedded.size).toBe(2000)
        // Tick 1: 8 full pages of 128 (its budget of 1024). Tick 2: 7 full pages, one of 80, then the re-index arm's one empty read.
        expect(vectors.wanting).toHaveBeenCalledTimes(8 + 8 + 1)
        expect(ai.embed).toHaveBeenCalledTimes(Math.ceil(1024 / 32) + Math.ceil(976 / 32))
        expect(vectors.storeMany).toHaveBeenCalledTimes(63)
        expect(Math.max(...ai.embed.mock.calls.map((call) => call[0].input.length))).toBe(32)
        // Never the same fact twice: the keyset moves past every page.
        expect(vectors.storeMany.mock.calls.flatMap((call) => call[1])).toHaveLength(2000)
        expect(logger.info).toHaveBeenCalledWith(BrainLogEvent.VectorsSwept, {
            workspaces: 1,
            embedded: 976,
            copied: 0,
            more: 0,
        })

        vectors.wanting.mockClear()
        await expect(service.sweep()).resolves.toEqual({ workspaces: 0, embedded: 0, copied: 0, more: 0 })
        expect(vectors.wanting).not.toHaveBeenCalled()
        expect(vectors.workspacesWanting).toHaveBeenCalledTimes(3)
    })

    it("reads the pages after the cursor of the page before, in id order, each at most 128", async () => {
        const { service, vectors } = await world(300)

        await expect(service.refresh(WS)).resolves.toEqual({ embedded: 300, copied: 0, unchanged: 0, more: false })

        expect(vectors.wanting.mock.calls.map((call) => call[2])).toEqual([
            { arm: "missing", afterId: null, limit: 128 },
            { arm: "missing", afterId: "f00127", limit: 128 },
            { arm: "missing", afterId: "f00255", limit: 128 },
            { arm: "other_identity", afterId: null, limit: 128 },
        ])
    })
})

describe("FactVectorsSweepService: a failure stops the sweep for the next tick and is never thrown", () => {
    it("an embedding call that answers nothing stops the workspace's sweep and reports more to do", async () => {
        const { service, ai, vectors } = await world(300)
        ai.embed.mockResolvedValue(null)

        await expect(service.refresh(WS)).resolves.toEqual({ embedded: 0, copied: 0, unchanged: 0, more: true })
        expect(vectors.wanting).toHaveBeenCalledTimes(1)
        expect(ai.embed).toHaveBeenCalledTimes(1)
    })

    it("reads nothing with the AI off; a read that fails is logged per workspace, a failed listing per tick", async () => {
        const off = await world(10)
        off.ai.available.mockReturnValue(false)
        await expect(off.service.sweep()).resolves.toEqual({ workspaces: 0, embedded: 0, copied: 0, more: 0 })
        await expect(off.service.refresh(WS)).resolves.toEqual({ embedded: 0, copied: 0, unchanged: 0, more: false })
        expect(off.vectors.workspacesWanting).not.toHaveBeenCalled()
        expect(off.vectors.wanting).not.toHaveBeenCalled()

        const failing = await world(10)
        const cause = new Error("db down")
        failing.vectors.wanting.mockRejectedValue(cause)
        await expect(failing.service.refresh(WS)).resolves.toEqual({
            embedded: 0,
            copied: 0,
            unchanged: 0,
            more: false,
        })
        expect(failing.logger.error).toHaveBeenCalledWith(BrainLogEvent.EmbeddingsFailed, cause, { workspaceId: WS })

        failing.vectors.workspacesWanting.mockRejectedValue(cause)
        await expect(failing.service.sweep()).resolves.toEqual({ workspaces: 0, embedded: 0, copied: 0, more: 0 })
        expect(failing.logger.error).toHaveBeenCalledWith(BrainLogEvent.VectorsSweepFailed, cause, {})
    })
})

describe("FactVectorsSweepService: the credit pool is checked before a workspace's embedding calls (owner 2026-11-11)", () => {
    it("an empty pool makes no call and counts the workspace as more to do; credits back, the next tick goes on", async () => {
        const { service, ai, usage, logger, embedded } = await world(40)
        usage.blockedBy.mockResolvedValueOnce(true)

        await expect(service.sweep()).resolves.toEqual({ workspaces: 1, embedded: 0, copied: 0, more: 1 })
        expect(ai.embed).not.toHaveBeenCalled()
        expect(usage.blockedBy).toHaveBeenCalledWith(WS, "embedding", true)
        expect(logger.info).toHaveBeenCalledWith(BrainLogEvent.VectorsBlockedCredits, { workspaceId: WS })

        await expect(service.sweep()).resolves.toEqual({ workspaces: 1, embedded: 40, copied: 0, more: 0 })
        expect(embedded.size).toBe(40)
    })
})
