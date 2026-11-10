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
        expect(write?.callsOf("where")).toEqual([[{ workspaceId: facts.WS, id: "f1", status: "active" }]])
        expect(write?.callsOf("setParameter")).toEqual([["vector", "[0.1,0.2,0.3]"]])
    })

    it("compares a question only with vectors of the same identity, and reads the facts back in rank order", async () => {
        const em = mockEntityManager({
            find: [BrainFactEntity, [facts.rowOf({ id: "f2", status: "active" }), facts.rowOf({ id: "f1", status: "active" })]],
        })
        const [rank] = queueQueryBuilders(em, [
            { getRawMany: [{ id: "f1", distance: "0.1" }, { id: "f2", distance: 0.4 }] },
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

    it("reads the facts in force with what their stored vectors say", async () => {
        const row = Object.assign(facts.rowOf({ status: "active" }), {
            embeddingModel: "embed",
            embeddingDimensions: 3,
            embeddingHash: "h",
        })
        const em = mockEntityManager({ find: [BrainFactEntity, [row]] })
        const service = await build(em)

        await expect(service.inForce(facts.WS, 50)).resolves.toMatchObject([
            { fact: { id: "f1" }, stored: { model: "embed", dimensions: 3, hash: "h" } },
        ])
        expect(em.find.mock.calls[0]?.[1]).toMatchObject({ where: { workspaceId: facts.WS, status: "active" }, take: 50 })
    })
})
