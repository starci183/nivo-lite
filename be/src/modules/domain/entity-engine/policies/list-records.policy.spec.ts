import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { entityCatalogOf, WORKSPACE_ID } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { MetaShape } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import type { Query } from "@nivo-lite/agent-sdk/query"
import { RecordEntity, RecordLinkEntity } from "../persistence/entities"
import { EntityEngineErrorCode } from "../errors/entity-engine.error"
import { listRecords } from "./list-records.policy"
import { mintScopedTx } from "./scoped-tx.policy"

const LIST_RECORDS: unique symbol = Symbol("entity-engine.list-records")

interface ListRecordsPolicy {
    readonly listRecords: typeof listRecords
}

const build = async (): Promise<ListRecordsPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: LIST_RECORDS, useFactory: (): ListRecordsPolicy => ({ listRecords }) }],
    }).compile()
    return moduleRef.get<ListRecordsPolicy>(LIST_RECORDS)
}

const CATALOG = entityCatalogOf(mock<MetaShape>())

const CREATED = new Date("2026-11-05T10:00:00.000Z")
const UPDATED = new Date("2026-11-05T11:00:00.000Z")

const rawRow = (id: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    id,
    workspace_id: WORKSPACE_ID,
    version: "2",
    created_at: CREATED,
    updated_at: UPDATED,
    data: { contactName: "An", phone: "0900" },
    ...extra,
})

const rowOf = (id: string): Record<string, unknown> => ({
    id,
    workspaceId: WORKSPACE_ID,
    version: "2",
    createdAt: CREATED.toISOString(),
    updatedAt: UPDATED.toISOString(),
    data: { contactName: "An" },
})

describe("listRecords", () => {
    it("reads one page plus its lookahead row from one statement pruned to the entity and the workspace", async () => {
        const policy = await build()
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [
            { getRawMany: [rawRow("r-1", { pk0: "2026-11-05 11:00:00+00", pk1: "r-1" })] },
        ])
        const query: Query = {
            from: "sales.lead",
            select: ["contactName"],
            order: [
                ["updatedAt", "desc"],
                ["id", "desc"],
            ],
            page: { size: 2 },
        }

        const rows = await policy.listRecords(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, {
            query,
            after: null,
        })

        expect(rows).toEqual([{ row: rowOf("r-1"), joined: {}, position: ["2026-11-05 11:00:00+00", "r-1"] }])
        expect(em.createQueryBuilder).toHaveBeenCalledWith(RecordEntity, "r")
        expect(fake?.callsOf("select")).toEqual([[[]]])
        expect(fake?.callsOf("addSelect")).toEqual([
            ["r.id", "id"],
            ["r.workspaceId", "workspace_id"],
            ["r.version", "version"],
            ["r.createdAt", "created_at"],
            ["r.updatedAt", "updated_at"],
            ["r.data", "data"],
            ["r.updatedAt", "o0"],
            ["CAST(r.updatedAt AS text)", "pk0"],
            ["r.id", "o1"],
            ["CAST(r.id AS text)", "pk1"],
        ])
        expect(fake?.callsOf("where")).toEqual([
            ["r.entity = :entity AND r.workspaceId = :ws", { entity: "sales.lead", ws: WORKSPACE_ID }],
        ])
        expect(fake?.callsOf("andWhere")).toEqual([])
        expect(fake?.callsOf("orderBy")).toEqual([["o0", "DESC"]])
        expect(fake?.callsOf("addOrderBy")).toEqual([["o1", "DESC"]])
        expect(fake?.callsOf("setParameters")).toEqual([[{}]])
        expect(fake?.callsOf("limit")).toEqual([[3]])
    })
})

describe("listRecords (2)", () => {
    it("applies the filter, the keyset position and a toOne join in the same statement", async () => {
        const policy = await build()
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [
            {
                getRawMany: [
                    rawRow("r-1", { j0_id: "m-1", j0_data: { title: "Sam", extra: 1 } }),
                    rawRow("r-2", { j0_id: null, j0_data: null }),
                    rawRow("r-3", { j0_id: "m-2", j0_data: "oops" }),
                ],
            },
        ])
        const query: Query = {
            from: "sales.lead",
            select: ["contactName"],
            join: { owner: ["title"] },
            where: { op: "eq", field: "stage", value: "won" },
            order: [
                ["updatedAt", "asc"],
                ["id", "asc"],
            ],
            page: { size: 2, after: "cursor" },
        }

        const rows = await policy.listRecords(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, {
            query,
            after: ["2026-11-04 10:00:00+00", "r-0"],
        })

        expect(rows.map(({ joined }) => joined)).toEqual([
            { owner: { id: "m-1", data: { title: "Sam" } } },
            { owner: null },
            { owner: null },
        ])
        expect(rows.map(({ row }) => row)).toEqual([rowOf("r-1"), rowOf("r-2"), rowOf("r-3")])
        expect(rows.map(({ position }) => position)).toEqual([
            [null, null],
            [null, null],
            [null, null],
        ])
        expect(fake?.callsOf("andWhere")).toEqual([
            ["r.data ->> CAST(:p0 AS text) = :p1"],
            ["(((r.updatedAt > :p2 OR r.updatedAt IS NULL)) OR (r.updatedAt = :p2 AND (r.id > :p3 OR r.id IS NULL)))"],
        ])
        expect(fake?.callsOf("leftJoin")).toEqual([
            [
                RecordLinkEntity,
                "l0",
                "l0.workspaceId = r.workspaceId AND l0.fromEntity = r.entity AND l0.fromId = r.id AND l0.relation = :p4 AND l0.toEntity = :p5",
            ],
            [RecordEntity, "t0", "t0.entity = l0.toEntity AND t0.id = l0.toId AND t0.workspaceId = r.workspaceId"],
        ])
        expect(fake?.callsOf("addSelect").slice(6, 8)).toEqual([
            ["t0.id", "j0_id"],
            ["t0.data", "j0_data"],
        ])
        expect(fake?.callsOf("setParameters")).toEqual([
            [
                {
                    p0: "stage",
                    p1: "won",
                    p2: "2026-11-04 10:00:00+00",
                    p3: "r-0",
                    p4: "owner",
                    p5: "sales.member",
                },
            ],
        ])
        expect(fake?.callsOf("orderBy")).toEqual([["o0", "ASC"]])
        expect(fake?.callsOf("addOrderBy")).toEqual([["o1", "ASC"]])
        expect(fake?.callsOf("limit")).toEqual([[3]])
    })
})

describe("listRecords (3)", () => {
    it("refuses a join over a relation the entity does not declare", async () => {
        const policy = await build()
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getRawMany: [] }])
        const query: Query = {
            from: "sales.lead",
            select: [],
            join: { ghost: [] },
            order: [["id", "asc"]],
            page: { size: 1 },
        }

        await expect(
            policy.listRecords(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, {
                query,
                after: null,
            }),
        ).rejects.toMatchObject({ code: EntityEngineErrorCode.RelationUnknown })
    })
})

describe("listRecords (4)", () => {
    it("refuses an entity the catalog does not hold before touching the database", async () => {
        const policy = await build()
        const em = mockEntityManager()
        const query: Query = { from: "sales.ghost", select: [], order: [["id", "asc"]], page: { size: 1 } }

        await expect(
            policy.listRecords(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, {
                query,
                after: null,
            }),
        ).rejects.toMatchObject({ code: EntityEngineErrorCode.EntityUnknown })
    })
})
