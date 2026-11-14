import * as facts from "@tests/fixtures/builders/brain-facts.builder"

import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { FindOperator, In } from "typeorm"
import { VECTOR_INDEX, type VectorPayload } from "@modules/integrations/qdrant"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { FakeVectorIndex } from "@tests/fixtures/builders/vector-sync.builder"
import { BrainFactEmbeddingsService } from "./brain-fact-embeddings.service"
import { BrainFactEntity } from "./persistence/entities"

const MODEL = "embed@3"
const IDENTITY = { model: MODEL, dimensions: 3 }
const OTHER_WS = "ws-2"

/** The mirror a truth's point holds, as the vector sync writes it from the row. */
const mirrorOf = (row: BrainFactEntity, over: Partial<VectorPayload> = {}): VectorPayload => ({
    workspaceId: row.workspaceId,
    sourceId: null,
    module: null,
    installationId: row.installationId,
    isPublic: row.scope === "public",
    customerReady: row.status === "active" && row.scope === "public",
    inForce: row.status === "active",
    model: MODEL,
    textHash: `hash-${row.id}`,
    ...over,
})

/** A world of truths: rows in a scripted Postgres (read by workspace and ids) and their points in a scripted index. */
const build = async (rows: ReadonlyArray<BrainFactEntity>) => {
    const index = new FakeVectorIndex()
    const em = mockEntityManager()
    em.find.mockImplementation((_entity, options) => {
        const where = (options as { where: { workspaceId: string; id: FindOperator<Array<string>> } }).where
        const ids: ReadonlyArray<string> = where.id.value ?? []
        return Promise.resolve(rows.filter((row) => row.workspaceId === where.workspaceId && ids.includes(row.id)))
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainFactEmbeddingsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: VECTOR_INDEX, useValue: index },
        ],
    }).compile()
    return { service: moduleRef.get(BrainFactEmbeddingsService), index, em }
}

describe("BrainFactEmbeddingsService.nearestRead: the meaning search of truths is the index's query, then the rows by id", () => {
    const shipping = facts.rowOf({ id: "ship", status: "active", scope: "public" })
    const internalFee = facts.rowOf({ id: "fee", status: "active", scope: "internal" })
    const restricted = facts.rowOf({ id: "salary", status: "active", scope: "restricted", modules: ["hiring"] })
    const proposal = facts.rowOf({ id: "waiting", status: "proposed", scope: "public" })
    const elsewhere = facts.rowOf({ id: "theirs", status: "active", scope: "public", workspaceId: OTHER_WS })

    const world = async () => {
        const built = await build([shipping, internalFee, restricted, proposal, elsewhere])
        for (const row of [shipping, internalFee, restricted, proposal, elsewhere]) built.index.put("truth", row.id, [1, 0, 0], mirrorOf(row))
        return built
    }

    it("a customer reads public truths in force of its own workspace only", async () => {
        const { service } = await world()

        const read = await service.nearestRead(facts.WS, IDENTITY, [1, 0, 0], 10, { audience: "customer", module: "chatbot", installationId: null })

        expect(read.indexDown).toBe(false)
        expect(read.facts.map((hit) => hit.fact.id)).toEqual(["ship"])
    })

    it("an internal reader reads the shared truths and the restricted ones of its module, never another workspace's or a waiting one", async () => {
        const { service } = await world()

        const sales = await service.nearestRead(facts.WS, IDENTITY, [1, 0, 0], 10, { audience: "internal", module: "sales", installationId: null })
        const hiring = await service.nearestRead(facts.WS, IDENTITY, [1, 0, 0], 10, { audience: "internal", module: "hiring", installationId: null })

        expect(sales.facts.map((hit) => hit.fact.id).toSorted()).toEqual(["fee", "ship"])
        expect(hiring.facts.map((hit) => hit.fact.id).toSorted()).toEqual(["fee", "salary", "ship"])
        expect([...sales.facts, ...hiring.facts].map((hit) => hit.fact.id)).not.toContain("theirs")
    })

    it("never shows a point the index still holds for a row Postgres no longer serves (superseded since), and compares one identity only", async () => {
        const { service, index } = await world()
        // The index lags: the row was superseded, its point still says in force; another model's point is never compared.
        index.put("truth", "gone", [1, 0, 0], mirrorOf(facts.rowOf({ id: "gone", status: "active" })))
        index.put("truth", "old", [1, 0, 0], mirrorOf(facts.rowOf({ id: "old", status: "active" }), { model: "embed@1536" }))

        const read = await service.nearestRead(facts.WS, IDENTITY, [1, 0, 0], 10)

        expect(read.facts.map((hit) => hit.fact.id).toSorted()).toEqual(["fee", "salary", "ship"])
        expect(read.facts.every((hit) => hit.distance >= 0)).toBe(true)
    })

    it("says the index is down instead of throwing, and never compares a question vector of another size", async () => {
        const { service, index, em } = await world()
        index.down = true

        await expect(service.nearestRead(facts.WS, IDENTITY, [1, 0, 0], 5)).resolves.toMatchObject({ facts: [], indexDown: true })
        await expect(service.nearestRead(facts.WS, IDENTITY, [1, 0], 5)).resolves.toEqual({ facts: [], indexDown: false })
        expect(em.find).not.toHaveBeenCalled()
    })
})

describe("BrainFactEmbeddingsService.nearestToRead: the truths near one STORED truth, by its own point", () => {
    it("finds the near truths of these statuses and the same instance scope, under the distance, the truth itself left out", async () => {
        const self = facts.rowOf({ id: "f1", status: "proposed" })
        const near = facts.rowOf({ id: "f2", status: "active" })
        const far = facts.rowOf({ id: "f3", status: "active" })
        const otherScope = facts.rowOf({ id: "f4", status: "active", installationId: "i9" })
        const { service, index } = await build([self, near, far, otherScope])
        index.put("truth", "f1", [1, 0, 0], mirrorOf(self))
        index.put("truth", "f2", [0.95, 0.05, 0], mirrorOf(near))
        index.put("truth", "f3", [0, 1, 0], mirrorOf(far))
        index.put("truth", "f4", [1, 0, 0], mirrorOf(otherScope))

        const read = await service.nearestToRead(facts.WS, "f1", IDENTITY, {
            statuses: ["active", "proposed"],
            installationId: null,
            maxDistance: 0.25,
            limit: 3,
        })

        expect(read.indexDown).toBe(false)
        expect(read.facts.map((hit) => hit.fact.id)).toEqual(["f2"])
    })

    it("a truth with no point yet finds nothing and says the index has not taken it in; no status, nothing is asked", async () => {
        const { service, index } = await build([facts.rowOf({ id: "f1" })])

        await expect(
            service.nearestToRead(facts.WS, "f1", IDENTITY, { statuses: ["active"], installationId: null, maxDistance: 1, limit: 3 }),
        ).resolves.toEqual({ facts: [], indexDown: true })
        await expect(
            service.nearestToRead(facts.WS, "f1", IDENTITY, { statuses: [], installationId: null, maxDistance: 1, limit: 3 }),
        ).resolves.toEqual({ facts: [], indexDown: false })
        expect(index.calls.search).toBeUndefined()
    })
})

describe("BrainFactEmbeddingsService.statesOf: what Postgres records of each truth's accepted point", () => {
    it("reads the identity (which names the size) and the hash of named truths of the workspace", async () => {
        const row = Object.assign(facts.rowOf({ id: "p1" }), { embeddingModel: MODEL, embeddingHash: "h" })
        const { service, em } = await build([row])

        await expect(service.statesOf(facts.WS, ["p1", "p1"])).resolves.toMatchObject([
            { fact: { id: "p1" }, stored: { model: MODEL, dimensions: 3, hash: "h" } },
        ])
        expect(em.find.mock.calls[0]?.[1]).toEqual({ where: { workspaceId: facts.WS, id: In(["p1"]) }, take: 1 })
        await expect(service.statesOf(facts.WS, [])).resolves.toEqual([])
    })

    it("a truth with no accepted point has no identity, no size and no hash", async () => {
        const { service } = await build([facts.rowOf({ id: "p2" })])

        await expect(service.statesOf(facts.WS, ["p2"])).resolves.toMatchObject([{ stored: { model: null, dimensions: null, hash: null } }])
    })
})
