import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { insertStampOf, WORKSPACE_ID } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import { RecordEntity } from "../persistence/entities"
import { EntityEngineErrorCode } from "../errors/entity-engine.error"
import { ensureRecord } from "./ensure-record.policy"
import { mintScopedTx } from "./scoped-tx.policy"

const ENSURE_RECORD: unique symbol = Symbol("entity-engine.ensure-record")

interface EnsureRecordPolicy {
    readonly ensureRecord: typeof ensureRecord
}

const build = async (): Promise<EnsureRecordPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: ENSURE_RECORD, useFactory: (): EnsureRecordPolicy => ({ ensureRecord }) }],
    }).compile()
    return moduleRef.get<EnsureRecordPolicy>(ENSURE_RECORD)
}

const CONTACT: EntityDefinition = {
    entry: "entity",
    name: "sales.contact",
    dataKind: "sales-contact",
    fields: {
        email: { kind: "text", nullable: true, maxLength: 100 },
        name: { kind: "text", nullable: false, maxLength: 100 },
    },
    matchKeys: [{ name: "byEmail", on: ["email"] }],
}
const CATALOG = new Map([[CONTACT.name, CONTACT]])

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

const insertedRow = (data: Record<string, unknown>): Record<string, unknown> => ({
    id: ID,
    workspace_id: WORKSPACE_ID,
    version: "1",
    created_at: AT,
    updated_at: AT,
    data,
})

/** Matches the raw SQL expression a builder assignment carries. */
const ANY_FUNCTION: unknown = expect.any(Function)

describe("ensureRecord", () => {
    it("answers the record that already has the match key's values", async () => {
        const policy = await build()
        const em = mockEntityManager(LOCKS)
        queueQueryBuilders(em, [{ getOne: stored }])

        const ensured = await policy.ensureRecord(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, {
            entity: "sales.contact",
            match: "byEmail",
            values: { email: "an@example.com", name: "An" },
            stamp: insertStampOf(),
        })

        expect(ensured.created).toBe(false)
        expect(ensured.row.id).toBe("c-1")
    })
})

describe("ensureRecord (2)", () => {
    it("inserts the record when none has the values", async () => {
        const policy = await build()
        const em = mockEntityManager(LOCKS)
        const [, insert] = queueQueryBuilders(em, [
            { getOne: null },
            { execute: { raw: [insertedRow({ email: "an@example.com", name: "An" })] } },
        ])

        const ensured = await policy.ensureRecord(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, {
            entity: "sales.contact",
            match: "byEmail",
            values: { email: "an@example.com", name: "An" },
            stamp: insertStampOf(),
        })

        expect(ensured.created).toBe(true)
        expect(insert?.callsOf("values")).toEqual([
            [
                {
                    id: ID,
                    workspaceId: WORKSPACE_ID,
                    entity: "sales.contact",
                    agentId: null,
                    data: ANY_FUNCTION,
                },
            ],
        ])
    })
})

describe("ensureRecord (3)", () => {
    it("inserts without a lookup when the key's value is absent, because null never matches", async () => {
        const policy = await build()
        const em = mockEntityManager(LOCKS)
        queueQueryBuilders(em, [{ execute: { raw: [insertedRow({ name: "An" })] } }])

        const ensured = await policy.ensureRecord(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, {
            entity: "sales.contact",
            match: "byEmail",
            values: { name: "An" },
            stamp: insertStampOf(),
        })

        expect(ensured.created).toBe(true)
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
    })
})

describe("ensureRecord (4)", () => {
    it("refuses a match key the entity does not declare", async () => {
        const policy = await build()
        const em = mockEntityManager()

        await expect(
            policy.ensureRecord(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, {
                entity: "sales.contact",
                match: "byGhost",
                values: {},
                stamp: insertStampOf(),
            }),
        ).rejects.toMatchObject({ code: EntityEngineErrorCode.KeyUnknown })
    })
})

describe("ensureRecord (5)", () => {
    it("refuses an entity without match keys", async () => {
        const policy = await build()
        const em = mockEntityManager()
        const bare: EntityDefinition = {
            entry: "entity",
            name: "sales.bare",
            dataKind: "sales-bare",
            fields: CONTACT.fields,
        }

        await expect(
            policy.ensureRecord(
                mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
                new Map([[bare.name, bare]]),
                {
                    entity: "sales.bare",
                    match: "byEmail",
                    values: {},
                    stamp: insertStampOf(),
                },
            ),
        ).rejects.toMatchObject({ code: EntityEngineErrorCode.KeyUnknown })
    })
})
