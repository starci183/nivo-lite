import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { BrainFactRelationsService } from "./brain-fact-relations.service"
import { BrainFactsErrorCode } from "./errors/brain-facts.error"
import { BrainFactEntity, BrainFactRelationEntity } from "./persistence/entities"

const WS = "11111111-1111-4111-8111-111111111111"
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const AT = new Date("2026-11-11T00:00:00.000Z")

const factRow = (id: string, status: "proposed" | "active" = "proposed") =>
    Object.assign(new BrainFactEntity(), { id, status })
const edgeRow = (changes: Partial<BrainFactRelationEntity> = {}) =>
    Object.assign(new BrainFactRelationEntity(), {
        id: "e1",
        workspaceId: WS,
        fromFactId: A,
        toFactId: B,
        kind: "part_of",
        label: "delivered by",
        createdBy: "Ada",
        createdAt: AT,
        updatedAt: AT,
        ...changes,
    })

/** An edge with another id and ends than the default one. */
const edgeBetween = (id: string, fromFactId: string, toFactId: string) => edgeRow({ id, fromFactId, toFactId })

/** The columns of an edge as the insert statement receives them. */
type InsertedEdge = Pick<
    BrainFactRelationEntity,
    "workspaceId" | "fromFactId" | "toFactId" | "kind" | "label" | "createdBy"
>

/** An edge of NIVO's reading as the insert statement receives it: A to B, part of, no label. */
const insertedEdge: (changes?: Partial<InsertedEdge>) => InsertedEdge = builder<InsertedEdge>({
    workspaceId: WS,
    fromFactId: A,
    toFactId: B,
    kind: "part_of",
    label: null,
    createdBy: "NIVO",
})

const build = async (em: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [BrainFactRelationsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(BrainFactRelationsService)
}

/** The second argument of each call a double saw: the options of a read or the condition of a delete. */
const optionsOf = (calls: ReadonlyArray<ReadonlyArray<unknown>>): ReadonlyArray<unknown> => calls.map((call) => call[1])

describe("BrainFactRelationsService link: relation CRUD under the workspace's row security", () => {
    it("links two facts of the workspace: both ends read in the workspace, the insert names it, the stored edge answers", async () => {
        const em = mockEntityManager({
            find: [BrainFactEntity, [factRow(A), factRow(B)]],
            findOne: [BrainFactRelationEntity, edgeRow()],
        })
        const [insert] = queueQueryBuilders(em, [{ execute: {} }])
        const service = await build(em)

        await expect(
            service.link(WS, { fromFactId: A, toFactId: B, kind: "part_of", label: "delivered by", createdBy: "Ada" }),
        ).resolves.toEqual({
            id: "e1",
            fromFactId: A,
            toFactId: B,
            kind: "part_of",
            label: "delivered by",
            createdBy: "Ada",
            createdAt: AT.toISOString(),
        })
        expect(optionsOf(em.find.mock.calls)).toEqual([
            { select: { id: true, status: true }, where: { workspaceId: WS, id: In([A, B]) }, take: 2 },
        ])
        expect(insert?.callsOf("values")).toEqual([[[insertedEdge({ label: "delivered by", createdBy: "Ada" })]]])
        expect(insert?.callsOf("orIgnore")).toEqual([[]])
        expect(optionsOf(em.findOne.mock.calls)).toEqual([
            { where: { workspaceId: WS, fromFactId: A, toFactId: B, kind: "part_of" } },
        ])
    })

    it("refuses a fact of another workspace (only one end found in this one) before writing", async () => {
        const em = mockEntityManager({ find: [BrainFactEntity, [factRow(A)]] })
        const service = await build(em)

        await expect(
            service.link(WS, { fromFactId: A, toFactId: B, kind: "related", createdBy: "Ada" }),
        ).rejects.toMatchObject({
            code: BrainFactsErrorCode.FactNotFound,
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("refuses an edge from a fact to itself before reading anything", async () => {
        const em = mockEntityManager()
        const service = await build(em)

        await expect(
            service.link(WS, { fromFactId: A, toFactId: A, kind: "related", createdBy: "Ada" }),
        ).rejects.toMatchObject({
            code: BrainFactsErrorCode.RelationInvalid,
        })
        expect(em.find).not.toHaveBeenCalled()
    })
})

describe("BrainFactRelationsService reads, removal and many links", () => {
    it("unlinks only an edge of the workspace and answers whether it was there", async () => {
        const em = mockEntityManager({
            delete: [
                [BrainFactRelationEntity, { raw: [], affected: 1 }],
                [BrainFactRelationEntity, { raw: [], affected: 0 }],
            ],
        })
        const service = await build(em)

        await expect(service.unlink(WS, "e1")).resolves.toBe(true)
        await expect(service.unlink(WS, "e2")).resolves.toBe(false)
        expect(optionsOf(em.delete.mock.calls)).toEqual([
            { workspaceId: WS, id: "e1" },
            { workspaceId: WS, id: "e2" },
        ])
    })

    it("reads the edges of facts both ways in the workspace, each edge once", async () => {
        const em = mockEntityManager({
            find: [
                [BrainFactRelationEntity, [edgeRow()]],
                [BrainFactRelationEntity, [edgeRow(), edgeBetween("e2", B, A)]],
            ],
        })
        const service = await build(em)

        const edges = await service.ofFacts(WS, [A, A])

        expect(edges.map((edge) => edge.id)).toEqual(["e1", "e2"])
        expect(optionsOf(em.find.mock.calls)).toEqual([
            expect.objectContaining({ where: { workspaceId: WS, fromFactId: In([A]) } }),
            expect.objectContaining({ where: { workspaceId: WS, toFactId: In([A]) } }),
        ])
    })

    it("links many edges of a reading, leaving out the ones that do not hold or name a fact of another workspace", async () => {
        const em = mockEntityManager({ find: [BrainFactEntity, [factRow(A), factRow(B)]] })
        const [insert] = queueQueryBuilders(em, [{ execute: {} }])
        const service = await build(em)

        await expect(
            service.linkMany(WS, [
                { fromFactId: A, toFactId: B, kind: "part_of", createdBy: "NIVO" },
                { fromFactId: A, toFactId: A, kind: "part_of", createdBy: "NIVO" },
                { fromFactId: A, toFactId: "elsewhere", kind: "related", createdBy: "NIVO" },
            ]),
        ).resolves.toBe(1)
        expect(insert?.callsOf("values")).toEqual([[[insertedEdge()]]])
    })

})

describe("BrainFactRelationsService: edges of a reading between facts in force, and carried edges", () => {
    it("never writes a reading's edge between two facts already in force: an edge of the model stands only once a person put its proposal in force (A.3)", async () => {
        const em = mockEntityManager({
            find: [BrainFactEntity, [factRow(A, "active"), factRow(B, "active"), factRow(C)]],
        })
        const [insert] = queueQueryBuilders(em, [{ execute: {} }])
        const service = await build(em)

        await expect(
            service.linkMany(WS, [
                { fromFactId: A, toFactId: B, kind: "part_of", createdBy: "NIVO" },
                { fromFactId: A, toFactId: C, kind: "applies_to", createdBy: "NIVO" },
                { fromFactId: C, toFactId: B, kind: "related", createdBy: "NIVO" },
            ]),
        ).resolves.toBe(2)
        expect(insert?.callsOf("values")).toEqual([
            [
                [
                    insertedEdge({ toFactId: C, kind: "applies_to" }),
                    insertedEdge({ fromFactId: C, toFactId: B, kind: "related" }),
                ],
            ],
        ])
    })

    it("writes nothing when every edge of a reading joins two facts in force", async () => {
        const em = mockEntityManager({ find: [BrainFactEntity, [factRow(A, "active"), factRow(B, "active")]] })
        const service = await build(em)

        await expect(
            service.linkMany(WS, [{ fromFactId: A, toFactId: B, kind: "part_of", createdBy: "NIVO" }]),
        ).resolves.toBe(0)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("carries the edges of a replaced value to its replacement in the transaction, never the edge between them", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                find: [
                    [BrainFactRelationEntity, [edgeBetween("out", A, C)]],
                    [
                        BrainFactRelationEntity,
                        [
                            edgeBetween("in", C, A),
                            edgeBetween("v", B, A),
                        ],
                    ],
                ],
            }),
        )
        const [insert] = queueQueryBuilders(tx.em, [{ execute: {} }])
        const service = await build(mockEntityManager())

        await service.carry(tx.em, WS, A, B)

        expect(optionsOf(tx.em.find.mock.calls)).toEqual([
            expect.objectContaining({ where: { workspaceId: WS, fromFactId: In([A]) } }),
            expect.objectContaining({ where: { workspaceId: WS, toFactId: In([A]) } }),
        ])
        expect(insert?.callsOf("values")).toEqual([
            [
                [
                    insertedEdge({ fromFactId: B, toFactId: C, label: "delivered by", createdBy: "Ada" }),
                    insertedEdge({ fromFactId: C, toFactId: B, label: "delivered by", createdBy: "Ada" }),
                ],
            ],
        ])
    })
})
