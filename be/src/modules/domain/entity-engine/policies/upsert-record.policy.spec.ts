import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { insertStampOf, WORKSPACE_ID } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import { RecordEntity } from "../persistence/entities"
import { EntityEngineErrorCode } from "../errors/entity-engine.error"
import { mintScopedTx } from "./scoped-tx.policy"
import { upsertRecord } from "./upsert-record.policy"

/** Matches the soft-delete guard TypeORM's `IsNull()` puts on `deletedAt`. */
const IS_NULL: unknown = expect.objectContaining({ _type: "isNull" })

const UPSERT_RECORD: unique symbol = Symbol("entity-engine.upsert-record")

interface UpsertRecordPolicy {
    readonly upsertRecord: typeof upsertRecord
}

const build = async (): Promise<UpsertRecordPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: UPSERT_RECORD, useFactory: (): UpsertRecordPolicy => ({ upsertRecord }) }],
    }).compile()
    return moduleRef.get<UpsertRecordPolicy>(UPSERT_RECORD)
}

const CONTACT: EntityDefinition = {
    entry: "entity",
    name: "sales.contact",
    dataKind: "sales-contact",
    fields: {
        email: { kind: "text", nullable: true, maxLength: 100 },
        name: { kind: "text", nullable: false, maxLength: 100 },
    },
    constraints: [
        { kind: "check", name: "name_present", expr: { op: "notNull", field: "name" }, refusal: "name_missing" },
        { kind: "unique", name: "email_taken", on: ["email"], refusal: "email_taken" },
    ],
}
const CATALOG = new Map([[CONTACT.name, CONTACT]])
const BARE: EntityDefinition = { entry: "entity", name: "sales.bare", dataKind: "sales-bare", fields: CONTACT.fields }

const AT = new Date("2026-11-05T10:00:00.000Z")
const ID = "00000000-0000-4000-8000-000000000001"

const stored = Object.assign(new RecordEntity(), {
    entity: "sales.contact",
    id: "c-1",
    workspaceId: WORKSPACE_ID,
    version: "1",
    createdAt: AT,
    updatedAt: AT,
    data: { email: "an@example.com", name: "An" },
})

const LOCKS = {
    query: [
        ['SELECT * FROM "pg_catalog"."hashtextextended"($1, $2)', [{ hashtextextended: "123" }]],
        ['SELECT * FROM "pg_catalog"."pg_advisory_xact_lock"($1)', []],
    ],
} as const

const returned = (id: string, version: string): Record<string, unknown> => ({
    id,
    workspace_id: WORKSPACE_ID,
    version,
    created_at: AT,
    updated_at: AT,
    data: { email: "an@example.com", name: "Anh" },
})

const INPUT = {
    entity: "sales.contact",
    constraint: "email_taken",
    values: { email: "an@example.com", name: "Anh" },
}

describe("upsertRecord", () => {
    it("patches the record the unique constraint's fields name", async () => {
        const policy = await build()
        const em = mockEntityManager(LOCKS)
        const [, update] = queueQueryBuilders(em, [{ getOne: stored }, { execute: { raw: [returned("c-1", "2")] } }])

        const upserted = await policy.upsertRecord(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, {
            ...INPUT,
            stamp: insertStampOf(),
        })

        expect(upserted.created).toBe(false)
        expect(upserted.row).toMatchObject({ id: "c-1", version: "2" })
        expect(update?.callsOf("where")).toEqual([
            [{ entity: "sales.contact", id: "c-1", workspaceId: WORKSPACE_ID, deletedAt: IS_NULL }],
        ])
        expect(update?.callsOf("setParameter")).toEqual([["patch", '{"email":"an@example.com","name":"Anh"}']])
    })
})

describe("upsertRecord (2)", () => {
    it("inserts when no record has the values", async () => {
        const policy = await build()
        const em = mockEntityManager(LOCKS)
        queueQueryBuilders(em, [{ getOne: null }, { execute: { raw: [returned(ID, "1")] } }])

        const upserted = await policy.upsertRecord(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, {
            ...INPUT,
            stamp: insertStampOf(),
        })

        expect(upserted).toMatchObject({ created: true, row: { id: ID } })
    })
})

describe("upsertRecord (3)", () => {
    it("inserts when the record vanished before the patch", async () => {
        const policy = await build()
        const em = mockEntityManager(LOCKS)
        queueQueryBuilders(em, [
            { getOne: stored },
            { execute: { raw: [] } },
            { execute: { raw: [returned(ID, "1")] } },
        ])

        const upserted = await policy.upsertRecord(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, {
            ...INPUT,
            stamp: insertStampOf(),
        })

        expect(upserted).toMatchObject({ created: true, row: { id: ID } })
    })
})

describe("upsertRecord (4)", () => {
    it("inserts without a lookup when the constraint's value is absent", async () => {
        const policy = await build()
        const em = mockEntityManager(LOCKS)
        queueQueryBuilders(em, [{ execute: { raw: [returned(ID, "1")] } }])

        const upserted = await policy.upsertRecord(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, {
            ...INPUT,
            values: { name: "Anh" },
            stamp: insertStampOf(),
        })

        expect(upserted.created).toBe(true)
    })

    it.each(["ghost", "name_present"])(
        "refuses %s, which is not a unique constraint of the entity",
        async (constraint) => {
            const policy = await build()
            const em = mockEntityManager()

            await expect(
                policy.upsertRecord(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, {
                    ...INPUT,
                    constraint,
                    stamp: insertStampOf(),
                }),
            ).rejects.toMatchObject({ code: EntityEngineErrorCode.KeyUnknown })
        },
    )

    it("refuses an entity without constraints", async () => {
        const policy = await build()
        const em = mockEntityManager()

        await expect(
            policy.upsertRecord(
                mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
                new Map([[BARE.name, BARE]]),
                {
                    ...INPUT,
                    entity: "sales.bare",
                    stamp: insertStampOf(),
                },
            ),
        ).rejects.toMatchObject({ code: EntityEngineErrorCode.KeyUnknown })
    })
})
