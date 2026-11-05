import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { entityCatalogOf, WORKSPACE_ID } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { MetaShape } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import type { Aggregate } from "@nivo-lite/agent-sdk/query"
import { RecordEntity } from "../persistence/entities"
import { aggregateRecords } from "./aggregate-records.policy"
import { EntityEngineErrorCode } from "../errors/entity-engine.error"
import { mintScopedTx } from "./scoped-tx.policy"

const AGGREGATE_RECORDS: unique symbol = Symbol("entity-engine.aggregate-records")

interface AggregateRecordsPolicy {
    readonly aggregateRecords: typeof aggregateRecords
}

const build = async (): Promise<AggregateRecordsPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: AGGREGATE_RECORDS, useFactory: (): AggregateRecordsPolicy => ({ aggregateRecords }) }],
    }).compile()
    return moduleRef.get<AggregateRecordsPolicy>(AGGREGATE_RECORDS)
}

const CATALOG = entityCatalogOf(mock<MetaShape>())

const MONTH = new Date("2026-11-01T00:00:00.000Z")

describe("aggregateRecords", () => {
    it("groups by a field and a time bucket and computes every measure in one statement", async () => {
        const policy = await build()
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [
            {
                getRawMany: [
                    { g0: "won", g1: MONTH, m0: "3", m1: "120", m2: "2", m3: MONTH },
                    { g0: null, g1: MONTH, m0: "1", m1: null, m2: "0", m3: null },
                ],
            },
        ])
        const aggregate: Aggregate = {
            from: "sales.lead",
            groupBy: ["stage"],
            bucket: { field: "closedAt", unit: "month" },
            measures: {
                n: { kind: "count" },
                total: { kind: "sum", field: "amount" },
                won: { kind: "count", where: { op: "eq", field: "stage", value: "won" } },
                last: { kind: "max", field: "closedAt" },
            },
            limit: 10,
        }

        const rows = await policy.aggregateRecords(
            mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
            CATALOG,
            aggregate,
        )

        expect(rows).toEqual([
            {
                groups: { stage: "won", closedAt: MONTH.toISOString() },
                measures: { n: 3, total: 120, won: 2, last: MONTH.toISOString() },
            },
            {
                groups: { stage: null, closedAt: MONTH.toISOString() },
                measures: { n: 1, total: null, won: 0, last: null },
            },
        ])
        expect(em.createQueryBuilder).toHaveBeenCalledWith(RecordEntity, "r")
        expect(fake?.callsOf("where")).toEqual([
            ["r.entity = :entity AND r.workspaceId = :ws", { entity: "sales.lead", ws: WORKSPACE_ID }],
        ])
        expect(fake?.callsOf("addSelect")).toEqual([
            ["r.data ->> CAST(:p0 AS text)", "g0"],
            ["date_trunc(CAST(:p1 AS text), CAST(r.data ->> CAST(:p2 AS text) AS timestamptz))", "g1"],
            ["COUNT(*)", "m0"],
            ["SUM(CAST(r.data ->> CAST(:p3 AS text) AS integer))", "m1"],
            ["COUNT(*) FILTER (WHERE r.data ->> CAST(:p4 AS text) = :p5)", "m2"],
            ["MAX(CAST(r.data ->> CAST(:p6 AS text) AS timestamptz))", "m3"],
        ])
        expect(fake?.callsOf("addGroupBy")).toEqual([["g0"], ["g1"]])
        expect(fake?.callsOf("addOrderBy")).toEqual([
            ["g0", "ASC"],
            ["g1", "ASC"],
        ])
        expect(fake?.callsOf("setParameters")).toEqual([
            [{ p0: "stage", p1: "month", p2: "closedAt", p3: "amount", p4: "stage", p5: "won", p6: "closedAt" }],
        ])
        expect(fake?.callsOf("limit")).toEqual([[10]])
    })
})

describe("aggregateRecords (2)", () => {
    it("filters, and answers one row of measures when nothing is grouped", async () => {
        const policy = await build()
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [{ getRawMany: [{ m0: "4", m1: "2.5" }] }])
        const aggregate: Aggregate = {
            from: "sales.lead",
            where: { op: "notNull", field: "phone" },
            measures: { n: { kind: "count", field: "phone" }, mean: { kind: "avg", field: "amount" } },
            limit: 1,
        }

        const rows = await policy.aggregateRecords(
            mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
            CATALOG,
            aggregate,
        )

        expect(rows).toEqual([{ groups: {}, measures: { n: 4, mean: 2.5 } }])
        expect(fake?.callsOf("andWhere")).toEqual([["r.data ->> CAST(:p0 AS text) IS NOT NULL"]])
        expect(fake?.callsOf("addSelect")).toEqual([
            ["COUNT(r.data ->> CAST(:p1 AS text))", "m0"],
            ["AVG(CAST(r.data ->> CAST(:p2 AS text) AS integer))", "m1"],
        ])
        expect(fake?.callsOf("addGroupBy")).toEqual([])
    })
})

describe("aggregateRecords (3)", () => {
    it("keeps the own scalar of min and max and writes a number or boolean group as text", async () => {
        const policy = await build()
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getRawMany: [{ g0: 5, m0: "abc", m1: true }] }])
        const aggregate: Aggregate = {
            from: "sales.lead",
            groupBy: ["amount"],
            measures: { first: { kind: "min", field: "contactName" }, flag: { kind: "max", field: "paid" } },
            limit: 5,
        }

        expect(
            await policy.aggregateRecords(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, aggregate),
        ).toEqual([{ groups: { amount: "5" }, measures: { first: "abc", flag: "true" } }])
    })
})

describe("aggregateRecords (4)", () => {
    it("refuses a returned column that is not a scalar", async () => {
        const policy = await build()
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getRawMany: [{ g0: {}, m0: "1" }] }])
        const aggregate: Aggregate = {
            from: "sales.lead",
            groupBy: ["stage"],
            measures: { n: { kind: "count" } },
            limit: 5,
        }

        await expect(
            policy.aggregateRecords(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, aggregate),
        ).rejects.toMatchObject({ code: EntityEngineErrorCode.ValueInvalid })
    })
})

describe("aggregateRecords (5)", () => {
    it("refuses a count that is not a number", async () => {
        const policy = await build()
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getRawMany: [{ m0: "many" }] }])
        const aggregate: Aggregate = { from: "sales.lead", measures: { n: { kind: "count" } }, limit: 1 }

        await expect(
            policy.aggregateRecords(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, aggregate),
        ).rejects.toMatchObject({ code: EntityEngineErrorCode.ValueInvalid })
    })
})
