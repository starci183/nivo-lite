import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { entityCatalogOf, WORKSPACE_ID } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { queueSubQueryBuilders } from "@tests/fixtures/builders/sub-query-builder.builder"
import type { MetaShape } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import type { IncludeSpec } from "@nivo-lite/agent-sdk/query"
import { RecordEntity, RecordLinkEntity } from "../persistence/entities"
import { EntityEngineErrorCode } from "../errors/entity-engine.error"
import { includeRecords } from "./include-records.policy"
import { mintScopedTx } from "./scoped-tx.policy"

const INCLUDE_RECORDS: unique symbol = Symbol("entity-engine.include-records")

interface IncludeRecordsPolicy {
    readonly includeRecords: typeof includeRecords
}

const build = async (): Promise<IncludeRecordsPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: INCLUDE_RECORDS, useFactory: (): IncludeRecordsPolicy => ({ includeRecords }) }],
    }).compile()
    return moduleRef.get<IncludeRecordsPolicy>(INCLUDE_RECORDS)
}

const CATALOG = entityCatalogOf(mock<MetaShape>())

const SPEC: IncludeSpec = {
    relation: "tasks",
    select: ["title"],
    order: [
        ["createdAt", "desc"],
        ["id", "desc"],
    ],
    latest: 2,
}

const rawTask = (parentId: string, id: string): Record<string, unknown> => ({
    parent_id: parentId,
    id,
    workspace_id: WORKSPACE_ID,
    version: "1",
    created_at: new Date("2026-11-05T10:00:00.000Z"),
    updated_at: new Date("2026-11-05T10:00:00.000Z"),
    data: { title: id, at: null },
})

const JOIN = "t.entity = l.toEntity AND t.id = l.toId AND t.workspaceId = l.workspaceId"
const SCOPED =
    "l.workspaceId = :ws AND l.fromEntity = :parent AND l.relation = :relation AND l.toEntity = :target AND t.entity = :target AND l.fromId IN (:...parentIds)"
const PARAMS = {
    ws: WORKSPACE_ID,
    parent: "sales.lead",
    relation: "tasks",
    target: "sales.task",
    parentIds: ["l-1", "l-2"],
    latest: 2,
}

describe("includeRecords", () => {
    it("reads nothing for a page without parents", async () => {
        const policy = await build()
        const em = mockEntityManager()

        const included = await policy.includeRecords(
            mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
            CATALOG,
            "sales.lead",
            SPEC,
            [],
        )

        expect(included.size).toBe(0)
    })
})

describe("includeRecords (2)", () => {
    it("groups the latest records of every parent of the page from one statement", async () => {
        const policy = await build()
        const em = mockEntityManager()
        const [fake] = queueSubQueryBuilders(em, [
            { getRawMany: [rawTask("l-1", "t-1"), rawTask("l-1", "t-2"), rawTask("l-2", "t-3")] },
        ])

        const included = await policy.includeRecords(
            mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
            CATALOG,
            "sales.lead",
            SPEC,
            ["l-1", "l-2"],
        )

        expect([...included.keys()]).toEqual(["l-1", "l-2"])
        expect(included.get("l-1")?.map(({ id, data }) => [id, data])).toEqual([
            ["t-1", { title: "t-1" }],
            ["t-2", { title: "t-2" }],
        ])
        expect(included.get("l-2")?.map(({ id }) => id)).toEqual(["t-3"])
        expect(em.createQueryBuilder).toHaveBeenCalledWith(RecordLinkEntity, "l")
        expect(fake?.callsOf("innerJoin")[0]).toEqual([RecordEntity, "t", JOIN])
        expect(fake?.callsOf("orderBy")).toEqual([["l.fromId", "ASC"]])
        expect(fake?.callsOf("addOrderBy")).toEqual([
            ["o0", "DESC"],
            ["o1", "DESC"],
        ])
        expect(fake?.callsOf("where")).toEqual([
            ["x.rn <= :latest"],
            ["l.workspaceId = :ws AND (l.fromId, t.id) IN (sub)"],
        ])
        expect(fake?.callsOf("setParameters")).toEqual([[PARAMS]])
    })
})

describe("includeRecords (3)", () => {
    it("ranks the links of the parents inside the derived table", async () => {
        const policy = await build()
        const em = mockEntityManager()
        const [fake] = queueSubQueryBuilders(em, [{ getRawMany: [] }])

        await policy.includeRecords(
            mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
            CATALOG,
            "sales.lead",
            SPEC,
            ["l-1", "l-2"],
        )

        const [derived, alias] = fake?.callsOf("from")[0] ?? []
        expect(alias).toBe("x")
        expect(typeof derived).toBe("function")
        if (typeof derived === "function") Reflect.apply(derived, undefined, [fake?.builder])
        expect(fake?.callsOf("select")).toEqual([["l.fromId", "parent_id"], ["x.parent_id"], ["l.fromId", "parent_id"]])
        expect(fake?.callsOf("addSelect").slice(-4)).toEqual([
            ["t.id", "o1"],
            ["x.id"],
            ["t.id", "id"],
            ["ROW_NUMBER() OVER (PARTITION BY l.fromId ORDER BY t.createdAt DESC, t.id DESC)", "rn"],
        ])
        expect(fake?.callsOf("where")).toContainEqual([SCOPED])
    })
})

describe("includeRecords (4)", () => {
    it("ranks by the include's order with its bound field names", async () => {
        const policy = await build()
        const em = mockEntityManager()
        const [fake] = queueSubQueryBuilders(em, [{ getRawMany: [] }])

        await policy.includeRecords(
            mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
            CATALOG,
            "sales.lead",
            { ...SPEC, order: [["title", "asc"]] },
            ["l-1"],
        )

        const [derived] = fake?.callsOf("from")[0] ?? []
        if (typeof derived === "function") Reflect.apply(derived, undefined, [fake?.builder])
        expect(fake?.callsOf("addSelect")).toContainEqual([
            "ROW_NUMBER() OVER (PARTITION BY l.fromId ORDER BY t.data ->> CAST(:p0 AS text) ASC)",
            "rn",
        ])
        expect(fake?.callsOf("setParameters")).toEqual([[{ ...PARAMS, p0: "title", parentIds: ["l-1"] }]])
    })
})

describe("includeRecords (5)", () => {
    it("refuses a relation the entity does not declare", async () => {
        const policy = await build()
        const em = mockEntityManager()

        await expect(
            policy.includeRecords(
                mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
                CATALOG,
                "sales.lead",
                { ...SPEC, relation: "ghost" },
                ["l-1"],
            ),
        ).rejects.toMatchObject({ code: EntityEngineErrorCode.RelationUnknown })
    })
})
