import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { entityCatalogOf, WORKSPACE_ID } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { MetaShape } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import { RecordEntity } from "../persistence/entities"
import { EntityEngineErrorCode } from "../errors/entity-engine.error"
import { deleteRecord } from "./delete-record.policy"
import { mintScopedTx } from "./scoped-tx.policy"
import { isRecord } from "@modules/platform/primitives"

const DELETE_RECORD: unique symbol = Symbol("entity-engine.delete-record")

interface DeleteRecordPolicy {
    readonly deleteRecord: typeof deleteRecord
}

const build = async (): Promise<DeleteRecordPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: DELETE_RECORD, useFactory: (): DeleteRecordPolicy => ({ deleteRecord }) }],
    }).compile()
    return moduleRef.get<DeleteRecordPolicy>(DELETE_RECORD)
}

const CALL: EntityDefinition = {
    entry: "entity",
    name: "sales.call",
    dataKind: "sales-call",
    fields: { title: { kind: "text", nullable: false, maxLength: 100 } },
    relations: { lead: { kind: "toOne", target: "sales.lead" } },
}

/** Leads, with two restrict relations pointing at them (tasks, calls) and one clear relation (notes). */
const CATALOG = new Map<string, EntityDefinition>([...entityCatalogOf(mock<MetaShape>()), [CALL.name, CALL]])

const IS_NULL: unknown = expect.objectContaining({ _type: "isNull" })

/** True for the `set` object of a soft delete: the two SQL-expression functions that stamp `deleted_at` and bump the version. */
const isSoftDeleteSet = (
    value: unknown,
): value is { readonly deletedAt: () => string; readonly version: () => string } =>
    isRecord(value) && typeof value["deletedAt"] === "function" && typeof value["version"] === "function"

describe("deleteRecord", () => {
    it("refuses the delete while a LIVE record still links to it through a restrict relation (a link from a deleted record does not count)", async () => {
        const policy = await build()
        const em = mockEntityManager()
        const [first] = queueQueryBuilders(em, [{ getCount: 1 }])

        const outcome = await policy.deleteRecord(
            mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
            CATALOG,
            "sales.lead",
            "r-1",
        )

        expect(outcome).toEqual({ kind: "blocked", relation: "lead" })
        expect(first?.callsOf("from")).toEqual([])
        expect(first?.callsOf("innerJoin")).toEqual([
            [RecordEntity, "s", "s.entity = k.fromEntity AND s.id = k.fromId AND s.workspaceId = k.workspaceId"],
        ])
        expect(first?.callsOf("where")).toEqual([
            [
                "k.workspaceId = :ws AND k.fromEntity = :from AND k.relation = :relation AND k.toEntity = :toEntity AND k.toId = :toId",
                { ws: WORKSPACE_ID, from: "sales.task", relation: "lead", toEntity: "sales.lead", toId: "r-1" },
            ],
        ])
        expect(em.delete).not.toHaveBeenCalled()
    })
})

describe("deleteRecord (2)", () => {
    it("SOFT-deletes the record: deleted_at set and version bumped in one update, no row and no link removed", async () => {
        const policy = await build()
        const em = mockEntityManager()
        const [taskRefs, callRefs, record] = queueQueryBuilders(em, [
            { getCount: 0 },
            { getCount: 0 },
            { execute: { raw: [{ id: "r-1" }] } },
        ])

        const outcome = await policy.deleteRecord(
            mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
            CATALOG,
            "sales.lead",
            "r-1",
        )

        expect(outcome).toEqual({ kind: "ok" })
        expect(taskRefs?.callsOf("getCount")).toHaveLength(1)
        expect(callRefs?.callsOf("getCount")).toHaveLength(1)
        expect(record?.callsOf("update")).toEqual([[RecordEntity]])
        expect(record?.callsOf("delete")).toEqual([])
        const [set] = record?.callsOf("set")[0] ?? []
        expect(isSoftDeleteSet(set) ? [Object.keys(set).sort(), set.deletedAt(), set.version()] : null).toEqual([
            ["deletedAt", "version"],
            "now()",
            "version + 1",
        ])
        expect(record?.callsOf("where")).toEqual([
            [{ entity: "sales.lead", id: "r-1", workspaceId: WORKSPACE_ID, deletedAt: IS_NULL }],
        ])
        expect(record?.callsOf("returning")).toEqual([["id"]])
        expect(em.delete).not.toHaveBeenCalled()
    })

    it("confines the soft delete to the scope's agent in a scope confined to one", async () => {
        const policy = await build()
        const em = mockEntityManager()
        const [, , record] = queueQueryBuilders(em, [{ getCount: 0 }, { getCount: 0 }, { execute: { raw: [] } }])

        const outcome = await policy.deleteRecord(
            mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID, agent: { id: "agent-a", sees: "own" } }),
            CATALOG,
            "sales.lead",
            "r-1",
        )

        expect(outcome).toEqual({ kind: "missing" })
        expect(record?.callsOf("where")).toEqual([
            [{ entity: "sales.lead", id: "r-1", workspaceId: WORKSPACE_ID, deletedAt: IS_NULL, agentId: "agent-a" }],
        ])
    })
})

describe("deleteRecord (3)", () => {
    it("answers missing when the workspace has no live such record (a record already deleted is not matched again)", async () => {
        const policy = await build()
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getCount: 0 }, { getCount: 0 }, { execute: { raw: [] } }])

        expect(
            await policy.deleteRecord(
                mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
                CATALOG,
                "sales.lead",
                "r-9",
            ),
        ).toEqual({
            kind: "missing",
        })
    })
})

describe("deleteRecord (4)", () => {
    it("refuses an entity that does not declare deletable records", async () => {
        const policy = await build()
        const em = mockEntityManager()

        await expect(
            policy.deleteRecord(
                mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
                CATALOG,
                "sales.member",
                "m-1",
            ),
        ).rejects.toMatchObject({ code: EntityEngineErrorCode.NotDeletable })
    })
})
