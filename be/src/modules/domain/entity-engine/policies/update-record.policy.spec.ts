import { Test } from "@nestjs/testing"
import { isRecord } from "@modules/platform/primitives"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { entityCatalogOf, WORKSPACE_ID } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { MetaShape } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { RecordEntity } from "../persistence/entities"
import { RECORD_RETURNING } from "./record-row.policy"
import { mintScopedTx } from "./scoped-tx.policy"
import { patchRecord, updateRecord } from "./update-record.policy"

const UPDATE_RECORD: unique symbol = Symbol("entity-engine.update-record")

interface UpdateRecordPolicy {
    readonly patchRecord: typeof patchRecord
    readonly updateRecord: typeof updateRecord
}

const build = async (): Promise<UpdateRecordPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: UPDATE_RECORD,
                useFactory: (): UpdateRecordPolicy => ({ patchRecord, updateRecord }),
            },
        ],
    }).compile()
    return moduleRef.get<UpdateRecordPolicy>(UPDATE_RECORD)
}

const CATALOG = entityCatalogOf(mock<MetaShape>())
const AT = new Date("2026-11-05T10:00:00.000Z")

const returned = (version: string): Record<string, unknown> => ({
    id: "r-1",
    workspace_id: WORKSPACE_ID,
    version,
    created_at: AT,
    updated_at: AT,
    data: { stage: "won" },
})

const existing = Object.assign(new RecordEntity(), {
    entity: "sales.lead",
    id: "r-1",
    workspaceId: WORKSPACE_ID,
    version: "5",
    createdAt: AT,
    updatedAt: AT,
    data: {},
})

describe("patchRecord", () => {
    it("merges the patch into data and bumps the version where the expected version still holds", async () => {
        const policy = await build()
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [{ execute: { raw: [returned("4")] } }])

        const row = await policy.patchRecord(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, {
            entity: "sales.lead",
            id: "r-1",
            expected: "3",
            patch: { stage: "won" },
        })

        expect(row?.version).toBe("4")
        expect(fake?.callsOf("update")).toEqual([[RecordEntity]])
        expect(fake?.callsOf("where")).toEqual([
            [{ entity: "sales.lead", id: "r-1", workspaceId: WORKSPACE_ID, version: "3" }],
        ])
        expect(fake?.callsOf("setParameter")).toEqual([["patch", '{"stage":"won"}']])
        expect(fake?.callsOf("returning")).toEqual([[RECORD_RETURNING]])
        const assignments = fake?.callsOf("set")[0]?.[0]
        const expressions = isRecord(assignments)
            ? Object.values(assignments).map((assign): unknown =>
                  typeof assign === "function" ? Reflect.apply(assign, undefined, []) : assign,
              )
            : []
        expect(expressions).toEqual(["data || CAST(:patch AS jsonb)", "version + 1"])
    })

    it("matches any version when none is expected", async () => {
        const policy = await build()
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [{ execute: { raw: [returned("6")] } }])

        await policy.patchRecord(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, {
            entity: "sales.lead",
            id: "r-1",
            expected: null,
            patch: {},
        })

        expect(fake?.callsOf("where")).toEqual([[{ entity: "sales.lead", id: "r-1", workspaceId: WORKSPACE_ID }]])
    })

    it("answers null when no row matched", async () => {
        const policy = await build()
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ execute: { raw: [] } }])

        expect(
            await policy.patchRecord(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, {
                entity: "sales.lead",
                id: "r-1",
                expected: "3",
                patch: {},
            }),
        ).toBeNull()
    })
})

describe("updateRecord", () => {
    it("answers the written row when the version held", async () => {
        const policy = await build()
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ execute: { raw: [returned("4")] } }])

        const outcome = await policy.updateRecord(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, {
            entity: "sales.lead",
            id: "r-1",
            expected: "3",
            patch: { stage: "won" },
        })

        expect(outcome).toMatchObject({ kind: "ok", row: { id: "r-1", version: "4" } })
    })

    it("answers stale when the record exists at another version", async () => {
        const policy = await build()
        const em = mockEntityManager({ findOne: [RecordEntity, existing] })
        queueQueryBuilders(em, [{ execute: { raw: [] } }])

        expect(
            await policy.updateRecord(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, {
                entity: "sales.lead",
                id: "r-1",
                expected: "3",
                patch: {},
            }),
        ).toEqual({ kind: "stale" })
    })

    it("answers missing when the workspace has no such record", async () => {
        const policy = await build()
        const em = mockEntityManager({ findOne: [RecordEntity, null] })
        queueQueryBuilders(em, [{ execute: { raw: [] } }])

        expect(
            await policy.updateRecord(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, {
                entity: "sales.lead",
                id: "r-9",
                expected: "3",
                patch: {},
            }),
        ).toEqual({ kind: "missing" })
    })
})
