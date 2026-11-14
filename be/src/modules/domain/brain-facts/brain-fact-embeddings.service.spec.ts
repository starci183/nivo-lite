import * as facts from "@tests/fixtures/builders/brain-facts.builder"

import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { BrainFactEmbeddingsService } from "./brain-fact-embeddings.service"
import { BrainFactEntity } from "./persistence/entities"

const IDENTITY = { model: "embed", dimensions: 3 }

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BrainFactEmbeddingsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(BrainFactEmbeddingsService)
}

describe("BrainFactEmbeddingsService", () => {
    it("records the identity and the text hash with the vector, on a fact in force of the workspace", async () => {
        const em = mockEntityManager()
        const [write] = queueQueryBuilders(em, [{ execute: {} }])
        const service = await build(em)

        await service.store(facts.WS, "f1", [0.1, 0.2, 0.3], IDENTITY, "hash-1")

        expect(evaluatedValues(write?.callsOf("set")[0]?.[0])).toEqual({
            embedding: "CAST(:vector AS extensions.vector)",
            embeddingModel: "embed",
            embeddingHash: "hash-1",
        })
        expect(write?.callsOf("where")).toEqual([
            [{ workspaceId: facts.WS, id: "f1", status: In(["active", "scheduled", "proposed"]) }],
        ])
        expect(write?.callsOf("setParameter")).toEqual([["vector", "[0.1,0.2,0.3]"]])
    })

    it("compares a question only with vectors of the same identity, and reads the facts back in rank order", async () => {
        const em = mockEntityManager({
            find: [
                BrainFactEntity,
                [facts.rowOf({ id: "f2", status: "active" }), facts.rowOf({ id: "f1", status: "active" })],
            ],
        })
        const [rank] = queueQueryBuilders(em, [
            {
                getRawMany: [
                    { id: "f1", distance: "0.1" },
                    { id: "f2", distance: 0.4 },
                ],
            },
        ])
        const service = await build(em)

        const near = await service.nearest(facts.WS, IDENTITY, [1, 0, 0], 5)

        expect(near.map((hit) => [hit.fact.id, hit.distance])).toEqual([
            ["f1", 0.1],
            ["f2", 0.4],
        ])
        const [condition, parameters] = rank?.callsOf("where")[0] ?? []
        expect(condition).toContain("f.embeddingModel = :model AND f.embeddingDimensions = :dimensions")
        expect(parameters).toMatchObject({ workspaceId: facts.WS, model: "embed", dimensions: 3, vector: "[1,0,0]" })
        expect(em.find.mock.calls[0]?.[1]).toEqual({ where: { workspaceId: facts.WS, id: In(["f1", "f2"]) }, take: 2 })
    })

    it("ranks only the facts a customer-facing lens may read: public, shared or its own instance, in SQL before the limit", async () => {
        const em = mockEntityManager()
        const [rank] = queueQueryBuilders(em, [{ getRawMany: [] }])
        const service = await build(em)

        await expect(
            service.nearest(facts.WS, IDENTITY, [1, 0, 0], 5, {
                audience: "customer",
                module: "chatbot",
                installationId: "i-1",
            }),
        ).resolves.toEqual([])
        expect(rank?.callsOf("andWhere")).toEqual([
            ["(f.installationId IS NULL OR f.installationId = :installationId)", { installationId: "i-1" }],
            ["f.scope = 'public'", { module: "chatbot" }],
        ])
    })

})

describe("BrainFactEmbeddingsService: the lens of a meaning search and the facts near a stored one", () => {
    it("ranks for an internal lens its shared facts and the restricted ones of its module", async () => {
        const em = mockEntityManager()
        const [rank] = queueQueryBuilders(em, [{ getRawMany: [] }])
        const service = await build(em)

        await service.nearest(facts.WS, IDENTITY, [1, 0, 0], 5, {
            audience: "internal",
            module: "sales",
            installationId: null,
        })
        expect(rank?.callsOf("andWhere")).toEqual([
            ["f.installationId IS NULL", { installationId: null }],
            ["(f.scope <> 'restricted' OR :module = ANY(f.modules))", { module: "sales" }],
        ])
    })

    it("finds the facts near one STORED fact by its own vector, same identity and scope, under the distance, itself left out", async () => {
        const em = mockEntityManager({ find: [BrainFactEntity, [facts.rowOf({ id: "f2" })]] })
        const [rank] = queueQueryBuilders(em, [{ getRawMany: [{ id: "f2", distance: "0.08" }] }])
        const service = await build(em)

        const near = await service.nearestTo(facts.WS, "f1", IDENTITY, {
            statuses: ["active", "proposed"],
            installationId: null,
            maxDistance: 0.25,
            limit: 3,
        })
        expect(near.map((hit) => [hit.fact.id, hit.distance])).toEqual([["f2", 0.08]])
        const [condition, parameters] = rank?.callsOf("where")[0] ?? []
        expect(condition).toContain("f.id <> :factId AND f.status IN (:...statuses)")
        expect(parameters).toEqual({
            workspaceId: facts.WS,
            factId: "f1",
            statuses: ["active", "proposed"],
            model: "embed",
            dimensions: 3,
        })
        const [scope, distance] = rank?.callsOf("andWhere") ?? []
        expect(scope).toEqual(["f.installationId IS NULL", { installationId: null }])
        expect(distance?.[0]).toContain("q.embedding_model = :model AND q.embedding_dimensions = :dimensions")
        expect(distance?.[1]).toEqual({ maxDistance: 0.25 })
        expect(rank?.callsOf("limit")).toEqual([[3]])
    })

    it("compares with no status at all: nothing is read", async () => {
        const em = mockEntityManager()
        const service = await build(em)

        await expect(
            service.nearestTo(facts.WS, "f1", IDENTITY, {
                statuses: [],
                installationId: null,
                maxDistance: 1,
                limit: 3,
            }),
        ).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

})

describe("BrainFactEmbeddingsService: stored state and the re-index reads", () => {
    it("reads the stored vector state of named facts", async () => {
        const row = Object.assign(facts.rowOf({ id: "p1" }), {
            embeddingModel: "embed",
            embeddingDimensions: 3,
            embeddingHash: "h",
        })
        const em = mockEntityManager({ find: [BrainFactEntity, [row]] })
        const service = await build(em)

        await expect(service.statesOf(facts.WS, ["p1", "p1"])).resolves.toMatchObject([
            { fact: { id: "p1" }, stored: { model: "embed", dimensions: 3, hash: "h" } },
        ])
        expect(em.find.mock.calls[0]?.[1]).toEqual({ where: { workspaceId: facts.WS, id: In(["p1"]) }, take: 1 })
        await expect(service.statesOf(facts.WS, [])).resolves.toEqual([])
    })

    it("never compares a question vector of another size: nothing is read", async () => {
        const em = mockEntityManager()
        const service = await build(em)

        await expect(service.nearest(facts.WS, IDENTITY, [1, 0], 5)).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("finds the rows of another identity for the re-index job, in the workspace", async () => {
        const em = mockEntityManager()
        const [read] = queueQueryBuilders(em, [{ getMany: [facts.rowOf({ id: "old" })] }])
        const service = await build(em)

        await expect(service.ofOtherIdentity(facts.WS, IDENTITY, 100)).resolves.toMatchObject([{ id: "old" }])
        const [condition, parameters] = read?.callsOf("where")[0] ?? []
        expect(condition).toContain("f.embeddingModel <> :model OR f.embeddingDimensions <> :dimensions")
        expect(parameters).toEqual({ workspaceId: facts.WS, model: "embed", dimensions: 3 })
    })
})

describe("BrainFactEmbeddingsService.adopt: a version that kept its line copies the vector, no embedding call (D-T2-1)", () => {
    const DONOR =
        "(SELECT s.embedding FROM public.brain_facts s WHERE s.workspace_id = :workspaceId AND s.embedding IS NOT NULL AND s.embedding_model = :model AND s.embedding_dimensions = :dimensions AND s.embedding_hash = :hash ORDER BY s.id LIMIT 1)"

    it("copies onto each fact the vector another row of the workspace holds for the same hash and identity", async () => {
        const em = mockEntityManager()
        const [kept, fresh] = queueQueryBuilders(em, [{ execute: { affected: 1 } }, { execute: { affected: 0 } }])
        const service = await build(em)

        const copied = await service.adopt(
            facts.WS,
            [
                { id: "08ee5a82", hash: "h-30" },
                { id: "deb9154f", hash: "h-32" },
                { id: "08ee5a82", hash: "h-30" },
            ],
            IDENTITY,
        )

        // Only the line some row already holds is copied; the other still needs an embedding. One write per fact, never twice.
        expect([...copied]).toEqual(["08ee5a82"])
        expect(evaluatedValues(kept?.callsOf("set")[0]?.[0])).toEqual({
            embedding: DONOR,
            embeddingModel: "embed",
            embeddingHash: "h-30",
        })
        expect(kept?.callsOf("where")).toEqual([
            [{ workspaceId: facts.WS, id: "08ee5a82", status: In(["active", "scheduled", "proposed"]) }],
        ])
        expect(kept?.callsOf("andWhere")).toEqual([[`EXISTS ${DONOR.replace("s.embedding FROM", "s.id FROM")}`]])
        expect(kept?.callsOf("setParameters")).toEqual([
            [{ workspaceId: facts.WS, model: "embed", dimensions: 3, hash: "h-30" }],
        ])
        expect(fresh?.callsOf("setParameters")).toEqual([
            [{ workspaceId: facts.WS, model: "embed", dimensions: 3, hash: "h-32" }],
        ])
    })

    it("asks nothing for no fact", async () => {
        const em = mockEntityManager()
        const service = await build(em)

        await expect(service.adopt(facts.WS, [], IDENTITY)).resolves.toEqual(new Set())
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("BrainFactEmbeddingsService: the reads of the sweep and the batched write", () => {
    it("reads one keyset page of the facts in force with NO vector: in id order after the cursor, never the oldest 500", async () => {
        const row = Object.assign(facts.rowOf({ id: "f9", status: "active" }), {
            embeddingModel: null,
            embeddingDimensions: null,
            embeddingHash: null,
        })
        const em = mockEntityManager()
        const [read] = queueQueryBuilders(em, [{ getMany: [row] }])
        const service = await build(em)

        await expect(
            service.wanting(facts.WS, IDENTITY, { arm: "missing", afterId: "f8", limit: 128 }),
        ).resolves.toMatchObject([{ fact: { id: "f9" }, stored: { model: null, dimensions: null, hash: null } }])
        expect(read?.callsOf("where")).toEqual([
            ["f.workspaceId = :workspaceId AND f.status = 'active'", { workspaceId: facts.WS }],
        ])
        expect(read?.callsOf("andWhere")).toEqual([["f.embedding IS NULL"], ["f.id > :afterId", { afterId: "f8" }]])
        expect(read?.callsOf("orderBy")).toEqual([["f.id", "ASC"]])
        expect(read?.callsOf("limit")).toEqual([[128]])
    })

    it("reads the re-index page by range on the identity (other model or size), the first page with no cursor", async () => {
        const em = mockEntityManager()
        const [read] = queueQueryBuilders(em, [{ getMany: [] }])
        const service = await build(em)

        await expect(
            service.wanting(facts.WS, IDENTITY, { arm: "other_identity", afterId: null, limit: 5000 }),
        ).resolves.toEqual([])
        expect(read?.callsOf("andWhere")).toEqual([
            [
                "f.embedding IS NOT NULL AND (f.embeddingModel < :model OR f.embeddingModel > :model OR f.embeddingDimensions <> :dimensions)",
                { model: "embed", dimensions: 3 },
            ],
        ])
        // A page is never larger than one read's bound.
        expect(read?.callsOf("limit")).toEqual([[500]])
    })

    it("names the workspaces that hold a fact in force with no vector, from the partial index alone", async () => {
        const em = mockEntityManager()
        const [read] = queueQueryBuilders(em, [{ getRawMany: [{ workspace: "ws-a" }, { workspace: "ws-b" }] }])
        const service = await build(em)

        await expect(service.workspacesWanting(50)).resolves.toEqual(["ws-a", "ws-b"])
        expect(read?.callsOf("select")).toEqual([["DISTINCT w.workspace_id", "workspace"]])
        expect(read?.callsOf("where")).toEqual([["w.status = 'active' AND w.embedding IS NULL"]])
        expect(read?.callsOf("limit")).toEqual([[50]])
    })
})

describe("BrainFactEmbeddingsService.storeMany: one write per embedding batch", () => {
    it("stores one batch of vectors in ONE write, each with the identity and its line hash", async () => {
        const em = mockEntityManager()
        const [write] = queueQueryBuilders(em, [{ execute: {} }])
        const service = await build(em)

        await service.storeMany(
            facts.WS,
            [
                { id: "f1", hash: "h1", vector: [0.1, 0.2, 0.3] },
                { id: "f2", hash: "h2", vector: [0.4, 0.5, 0.6] },
            ],
            IDENTITY,
        )

        // Each id picks its vector and its hash out of the two arrays the one statement carries.
        const set = JSON.stringify(evaluatedValues(write?.callsOf("set")[0]?.[0]))
        expect(set).toContain('"embeddingModel":"embed"')
        expect(set).toContain("unnest(CAST(:ids AS uuid[]), CAST(:vectors AS text[]))")
        expect(set).toContain("unnest(CAST(:ids AS uuid[]), CAST(:hashes AS text[]))")
        expect(write?.callsOf("where")[0]?.[0]).toContain("status IN ('active', 'scheduled', 'proposed')")
        expect(write?.callsOf("setParameters")).toEqual([
            [
                {
                    workspaceId: facts.WS,
                    ids: ["f1", "f2"],
                    vectors: ["[0.1,0.2,0.3]", "[0.4,0.5,0.6]"],
                    hashes: ["h1", "h2"],
                },
            ],
        ])
    })

    it("writes nothing for an empty batch", async () => {
        const em = mockEntityManager()
        const service = await build(em)

        await service.storeMany(facts.WS, [], IDENTITY)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})
