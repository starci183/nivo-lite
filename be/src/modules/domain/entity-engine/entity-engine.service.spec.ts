import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { queueSubQueryBuilders } from "@tests/fixtures/builders/sub-query-builder.builder"
import { Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { deriveStateKey } from "@modules/platform/primitives"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { Aggregate, Query } from "@nivo-lite/agent-sdk/query"
import { signCursor } from "./cursor.policy"
import { EngineFailureService } from "./engine-failure.service"
import { ENTITY_ENGINE_OPTIONS } from "./entity-engine.decorators"
import type { EntityEngineOptions } from "./entity-engine.options"
import { EntityEngineService } from "./entity-engine.service"
import { EntityEngineErrorCode } from "./errors/entity-engine.error"
import { RecordEntity } from "./persistence/entities"
import type { ScopedTx } from "./policies/scoped-tx.contracts"
import { mintScopedTx } from "./policies/scoped-tx.policy"

const WS = "11111111-1111-4111-8111-111111111111"
const LEAD_ID = "33333333-3333-4333-8333-333333333333"
const AT = new Date("2026-11-05T10:00:00.000Z")
const KEY_B64 = Buffer.alloc(32, 5).toString("base64")
const SCOPE_SQL = 'SELECT * FROM "public"."engine_scope_enter"($1)'

const LEAD: EntityDefinition = {
    entry: "entity",
    name: "sales.lead",
    dataKind: "sales-lead",
    fields: {
        contactName: { kind: "text", nullable: false, maxLength: 200 },
        stage: { kind: "enum", nullable: false, of: ["new", "won"] },
    },
    relations: { tasks: { kind: "toMany", target: "sales.task" } },
    indexes: [{ name: "recent", on: [{ desc: "updatedAt" }, { desc: "id" }] }],
}
const TASK: EntityDefinition = {
    entry: "entity",
    name: "sales.task",
    dataKind: "sales-task",
    fields: { title: { kind: "text", nullable: false, maxLength: 100 } },
}

const rawRecord = (id: string, data: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    id,
    workspace_id: WS,
    version: "1",
    created_at: AT,
    updated_at: AT,
    data,
    ...extra,
})

const rowOf = (id: string, data: Record<string, unknown>, version = "1") => ({
    id,
    workspaceId: WS,
    version,
    createdAt: AT.toISOString(),
    updatedAt: AT.toISOString(),
    data,
})

const storedLead = Object.assign(new RecordEntity(), {
    entity: "sales.lead",
    id: LEAD_ID,
    workspaceId: WS,
    version: "3",
    createdAt: AT,
    updatedAt: AT,
    data: { contactName: "An" },
})

const build = async (em: MockEntityManager, overrides: Partial<EntityEngineOptions> = {}) => {
    fakeTransaction(em)
    const failures = mock<EngineFailureService>()
    failures.reading.mockImplementation((_entity, work) => work())
    const moduleRef = await Test.createTestingModule({
        providers: [
            EntityEngineService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            {
                provide: ENTITY_ENGINE_OPTIONS,
                useValue: builder<EntityEngineOptions>({
                    entities: [LEAD, TASK],
                    jobs: [],
                    cursorKey: new Secret(KEY_B64),
                })(overrides),
            },
            { provide: EngineFailureService, useValue: failures },
        ],
    }).compile()
    return { engine: moduleRef.get(EntityEngineService), em, failures }
}

const txOf = (manager: MockEntityManager): ScopedTx => mintScopedTx({ manager, workspaceId: WS })

describe("EntityEngineService construction", () => {
    it("refuses a cursor key that is not 32 bytes", async () => {
        await expect(build(mockEntityManager(), { cursorKey: new Secret("c2hvcnQ=") })).rejects.toMatchObject({
            code: EntityEngineErrorCode.CursorKeyInvalid,
        })
    })

    it("holds the entity declarations by name", async () => {
        const { engine } = await build(mockEntityManager())

        expect([...engine.catalog.keys()]).toEqual(["sales.lead", "sales.task"])
    })
})

describe("EntityEngineService scoped", () => {
    it("enters the workspace scope as the first statement, then runs the work in the same transaction", async () => {
        const { engine, em } = await build(mockEntityManager({ query: [SCOPE_SQL, []] }))

        const seen = await engine.scoped(WS, (tx) => Promise.resolve([em.query.mock.calls.length, tx.workspaceId]))

        expect(seen).toEqual([1, WS])
        expect(em.query).toHaveBeenCalledWith(SCOPE_SQL, [WS])
        expect(em.transaction).toHaveBeenCalledTimes(1)
    })

    it("refuses a workspace that is not a uuid before opening a transaction", async () => {
        const { engine, em } = await build(mockEntityManager())

        await expect(engine.scoped("not-a-uuid", () => Promise.resolve(1))).rejects.toMatchObject({
            code: EntityEngineErrorCode.ScopeInvalid,
            params: { workspaceId: "not-a-uuid" },
        })
        expect(em.transaction).not.toHaveBeenCalled()
    })
})

describe("EntityEngineService within", () => {
    const LEAVE_SQL = 'SELECT * FROM "public"."engine_scope_leave"()'

    it("enters the scope on the caller's manager, runs the work and leaves the scope", async () => {
        const { engine, em } = await build(mockEntityManager({ query: [SCOPE_SQL, []] }))
        em.query.mockResolvedValue([])

        const seen = await engine.within(em, WS, (tx) => Promise.resolve([tx.manager === em, tx.workspaceId]))

        expect(seen).toEqual([true, WS])
        expect(em.query.mock.calls.map((call) => call[0])).toEqual([SCOPE_SQL, LEAVE_SQL])
        expect(em.transaction).not.toHaveBeenCalled()
    })

    it("leaves the scope when the work throws", async () => {
        const { engine, em } = await build(mockEntityManager({ query: [SCOPE_SQL, []] }))
        em.query.mockResolvedValue([])

        await expect(engine.within(em, WS, jest.fn().mockRejectedValue(new Error("boom")))).rejects.toThrow("boom")

        expect(em.query.mock.calls.map((call) => call[0])).toEqual([SCOPE_SQL, LEAVE_SQL])
    })

    it("refuses a workspace that is not a uuid before any statement", async () => {
        const { engine, em } = await build(mockEntityManager())

        await expect(engine.within(em, "nope", () => Promise.resolve(1))).rejects.toMatchObject({
            code: EntityEngineErrorCode.ScopeInvalid,
        })
        expect(em.query).not.toHaveBeenCalled()
    })
})

describe("EntityEngineService definition and get", () => {
    it("answers the declaration of a catalog entity and refuses a name the catalog does not hold", async () => {
        const { engine } = await build(mockEntityManager())

        expect(engine.definition("sales.lead")).toBe(LEAD)
        expect(() => engine.definition("sales.nothing")).toThrow(EntityEngineErrorCode.EntityUnknown)
    })

    it("reads one record of the scope's workspace", async () => {
        const { engine, em } = await build(mockEntityManager({ findOne: [RecordEntity, storedLead] }))

        const row = await engine.get(txOf(em), "sales.lead", LEAD_ID)

        expect(row).toEqual(rowOf(LEAD_ID, { contactName: "An" }, "3"))
        expect(em.findOne).toHaveBeenCalledWith(RecordEntity, {
            where: { entity: "sales.lead", id: LEAD_ID, workspaceId: WS },
        })
    })

    it("answers null for a record that is not there", async () => {
        const { engine, em } = await build(mockEntityManager({ findOne: [RecordEntity, null] }))

        await expect(engine.get(txOf(em), "sales.lead", LEAD_ID)).resolves.toBeNull()
    })

    it("refuses an entity the catalog does not hold", async () => {
        const { engine, em } = await build(mockEntityManager())

        await expect(engine.get(txOf(em), "sales.nothing", LEAD_ID)).rejects.toMatchObject({
            code: EntityEngineErrorCode.EntityUnknown,
        })
    })
})

describe("EntityEngineService list", () => {
    const LIST: Query = {
        from: "sales.lead",
        select: ["contactName"],
        order: [
            ["updatedAt", "desc"],
            ["id", "desc"],
        ],
        page: { size: 1 },
    }
    const cursorKey = deriveStateKey(KEY_B64, "entity-engine.cursor") ?? Buffer.alloc(0)

    it("answers a page with the signed cursor of the next one and the toMany records of its rows", async () => {
        const { engine, em } = await build(mockEntityManager())
        queueSubQueryBuilders(em, [
            {
                getRawMany: [
                    rawRecord("r-1", { contactName: "An" }, { pk0: "t-1", pk1: "r-1" }),
                    rawRecord("r-2", { contactName: "Binh" }, { pk0: "t-2", pk1: "r-2" }),
                ],
            },
            { getRawMany: [rawRecord("k-1", { title: "Call" }, { parent_id: "r-1" })] },
        ])
        const query: Query = {
            ...LIST,
            include: [{ relation: "tasks", select: ["title"], order: [["id", "asc"]], latest: 2 }],
        }

        const page = await engine.list(txOf(em), query, "scope-1")

        expect(page.rows.map((listed) => [listed.row.id, listed.included])).toEqual([
            ["r-1", { tasks: [rowOf("k-1", { title: "Call" })] }],
        ])
        expect(page.next).toBe(signCursor(cursorKey, "scope-1", ["t-1", "r-1"]))
    })

    it("answers no cursor on the last page and no included records for a query without includes", async () => {
        const { engine, em } = await build(mockEntityManager())
        queueQueryBuilders(em, [{ getRawMany: [rawRecord("r-1", { contactName: "An" }, { pk0: "t-1", pk1: "r-1" })] }])

        const page = await engine.list(txOf(em), LIST, "scope-1")

        expect(page.rows.map((listed) => [listed.row.id, listed.included])).toEqual([["r-1", {}]])
        expect(page.next).toBeNull()
    })

    it("resumes after the position a cursor of the same list holds", async () => {
        const { engine, em } = await build(mockEntityManager())
        const [fake] = queueQueryBuilders(em, [{ getRawMany: [] }])
        const after = signCursor(cursorKey, "scope-1", ["t-1", "r-1"])

        const page = await engine.list(txOf(em), { ...LIST, page: { size: 1, after } }, "scope-1")

        expect(page).toEqual({ rows: [], next: null })
        expect(fake?.callsOf("andWhere")).toHaveLength(1)
    })

    it("refuses a cursor minted for another list", async () => {
        const { engine, em } = await build(mockEntityManager())
        const after = signCursor(cursorKey, "scope-2", ["t-1", "r-1"])

        await expect(engine.list(txOf(em), { ...LIST, page: { size: 1, after } }, "scope-1")).rejects.toMatchObject({
            code: EntityEngineErrorCode.CursorInvalid,
        })
    })

    it("refuses a query tree the catalog rejects, before any statement", async () => {
        const { engine, em } = await build(mockEntityManager())

        await expect(engine.list(txOf(em), { ...LIST, from: "sales.nothing" }, "scope-1")).rejects.toMatchObject({
            code: EntityEngineErrorCode.QueryInvalid,
            params: { problem: "QUERY_ENTITY_UNKNOWN", at: "from", entity: "sales.nothing" },
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("EntityEngineService aggregate", () => {
    const COUNT: Aggregate = { from: "sales.lead", groupBy: ["stage"], measures: { n: { kind: "count" } }, limit: 10 }

    it("answers the groups and measures of the aggregate", async () => {
        const { engine, em } = await build(mockEntityManager())
        queueQueryBuilders(em, [{ getRawMany: [{ g0: "new", m0: "4" }] }])

        await expect(engine.aggregate(txOf(em), COUNT)).resolves.toEqual([
            { groups: { stage: "new" }, measures: { n: 4 } },
        ])
    })

    it("refuses an aggregate the catalog rejects", async () => {
        const { engine, em } = await build(mockEntityManager())

        await expect(engine.aggregate(txOf(em), { ...COUNT, groupBy: ["nothing"] })).rejects.toMatchObject({
            code: EntityEngineErrorCode.QueryInvalid,
        })
    })
})
