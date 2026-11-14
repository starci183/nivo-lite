import { Test } from "@nestjs/testing"
import { In } from "typeorm"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { rowOf, WS } from "@tests/fixtures/builders/brain-facts.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { factEmbedHashOf, factEmbedTextOf } from "./embedding-standard.policy"
import { toFactRecord } from "./fact-record.mapper"
import { FactVectorRowsService } from "./fact-vector-rows.service"
import { BrainFactEntity } from "./persistence/entities"

const build = async (em: ReturnType<typeof mockEntityManager>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [FactVectorRowsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(FactVectorRowsService)
}

describe("FactVectorRowsService", () => {
    it("reads the truths of one workspace by id as rows that want a point, mirroring what the index filters by", async () => {
        const row = rowOf({ id: "f1", status: "active", scope: "public" })
        const em = mockEntityManager({ find: [BrainFactEntity, [row]] })
        const service = await build(em)

        const rows = await service.byIds(WS, ["f1", "f1"])

        const fact = toFactRecord(row)
        expect(em.find).toHaveBeenCalledWith(BrainFactEntity, { where: { workspaceId: WS, id: In(["f1"]) }, take: 1 })
        expect(rows).toEqual([
            {
                id: "f1",
                workspaceId: WS,
                wanted: true,
                text: factEmbedTextOf(fact),
                textHash: factEmbedHashOf(fact),
                mirror: {
                    workspaceId: WS,
                    sourceId: null,
                    module: null,
                    installationId: null,
                    isPublic: true,
                    customerReady: true,
                    inForce: true,
                },
                stamped: false,
                stampedModel: null,
            },
        ])
    })

    it("wants no point for a truth that is neither in force nor waiting", async () => {
        const em = mockEntityManager({ find: [BrainFactEntity, [rowOf({ id: "f2", status: "superseded" })]] })
        const service = await build(em)

        const rows = await service.byIds(WS, ["f2"])

        expect(rows.map((row) => [row.id, row.wanted, row.mirror.inForce])).toEqual([["f2", false, false]])
    })

    it("wants a point for a truth scheduled for a later start, never an in-force one: it is compared, not searched (Round W, D-W-2)", async () => {
        const em = mockEntityManager({ find: [BrainFactEntity, [rowOf({ id: "f3", status: "scheduled", scope: "public" })]] })
        const service = await build(em)

        const rows = await service.byIds(WS, ["f3"])

        expect(rows.map((row) => [row.id, row.wanted, row.mirror.inForce, row.mirror.customerReady])).toEqual([
            ["f3", true, false, false],
        ])
    })

    it("reads nothing for no ids", async () => {
        const em = mockEntityManager()
        const service = await build(em)

        await expect(service.byIds(WS, [])).resolves.toEqual([])
        await expect(service.wantedAmong([])).resolves.toEqual([])
        await expect(service.storedVectors(WS, [], "m1")).resolves.toEqual(new Map())
        await expect(service.donors(WS, [], "m1", [])).resolves.toEqual(new Map())

        expect(em.find).not.toHaveBeenCalled()
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("belongs to no document", async () => {
        const service = await build(mockEntityManager())

        await expect(service.ofSource()).resolves.toEqual([])
    })
})

describe("FactVectorRowsService, pages, donors and stamps", () => {
    it("reads a page of every truth after a cursor, bounded between 1 and 500", async () => {
        const em = mockEntityManager()
        const [first, second] = queueQueryBuilders(em, [{ getMany: [rowOf()] }, { getMany: [] }])
        const service = await build(em)

        await expect(service.page("f0", 9999)).resolves.toHaveLength(1)
        await service.page(null, 0)

        expect(first?.callsOf("where")).toEqual([["f.id > :afterId", { afterId: "f0" }]])
        expect(first?.callsOf("limit")).toEqual([[500]])
        expect(second?.callsOf("where")).toEqual([])
        expect(second?.callsOf("limit")).toEqual([[1]])
    })

    it("names which of the ids exist as a truth in force or waiting, whatever workspace", async () => {
        const em = mockEntityManager({ find: [BrainFactEntity, [rowOf({ id: "f1" })]] })
        const service = await build(em)

        await expect(service.wantedAmong(["f1", "f2"])).resolves.toEqual([{ id: "f1", workspaceId: WS }])
        expect(em.find).toHaveBeenCalledWith(BrainFactEntity, {
            select: { id: true, workspaceId: true },
            where: { id: In(["f1", "f2"]), status: In(["active", "scheduled", "proposed"]) },
            take: 2,
        })
    })

    it("names one donor per line hash, never a row that is itself being stamped", async () => {
        const em = mockEntityManager()
        const [read] = queueQueryBuilders(em, [
            {
                getRawMany: [
                    { id: "f1", hash: "h1" },
                    { id: "f2", hash: "h1" },
                    { id: "f3", hash: "h2" },
                ],
            },
        ])
        const service = await build(em)

        const donors = await service.donors(WS, ["h1", "h2", "h1"], "m1", ["f1"])

        expect(donors).toEqual(
            new Map([
                ["h1", "f2"],
                ["h2", "f3"],
            ]),
        )
        expect(read?.callsOf("limit")).toEqual([[500]])
    })

    it("stamps the accepted truths in one write, and writes nothing for none", async () => {
        const em = mockEntityManager()
        const [update] = queueQueryBuilders(em, [{ execute: {} }])
        const service = await build(em)

        await service.stamp(WS, [], "m1")
        expect(em.createQueryBuilder).not.toHaveBeenCalled()

        await service.stamp(
            WS,
            [
                { id: "f1", textHash: "h1" },
                { id: "f2", textHash: "h2" },
            ],
            "m1",
        )

        expect(update?.callsOf("setParameters")).toEqual([
            [{ workspaceId: WS, model: "m1", ids: ["f1", "f2"], hashes: ["h1", "h2"] }],
        ])
        expect(update?.callsOf("execute")).toHaveLength(1)
    })
})
