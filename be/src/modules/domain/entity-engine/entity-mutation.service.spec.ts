import { Test } from "@nestjs/testing"
import { builder, fakeIds, fakeTransaction, FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { IDS } from "@modules/platform/ids"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { Delete, Insert, Mutation } from "@nivo-lite/agent-sdk/mutation"
import { EngineFailureService } from "./engine-failure.service"
import { ENTITY_ENGINE_OPTIONS } from "./entity-engine.decorators"
import type { EntityEngineOptions } from "./entity-engine.options"
import { EntityEngineService } from "./entity-engine.service"
import { EntityMutationService } from "./entity-mutation.service"
import { EntityEngineError, EntityEngineErrorCode } from "./errors/entity-engine.error"
import { RecordEntity, RecordLinkEntity } from "./persistence/entities"
import type { ScopedTx } from "./policies/scoped-tx.contracts"
import { mintScopedTx } from "./policies/scoped-tx.policy"

const WS = "11111111-1111-4111-8111-111111111111"
const OWNER_ID = "22222222-2222-4222-8222-222222222222"
const LEAD_ID = "33333333-3333-4333-8333-333333333333"
const NEW_ID = "00000000-0000-4000-8000-000000000001"
const AT = new Date("2026-11-05T10:00:00.000Z")
const HASH_SQL = 'SELECT * FROM "pg_catalog"."hashtextextended"($1, $2)'
const LOCK_SQL = 'SELECT * FROM "pg_catalog"."pg_advisory_xact_lock"($1)'

const LEAD: EntityDefinition = {
    entry: "entity",
    name: "sales.lead",
    dataKind: "sales-lead",
    deletable: true,
    fields: {
        contactName: { kind: "text", nullable: false, maxLength: 200 },
        phone: { kind: "text", nullable: true, maxLength: 30 },
        stage: { kind: "enum", nullable: false, of: ["new", "won"], default: { literal: "new" } },
    },
    relations: { owner: { kind: "toOne", target: "sales.member" } },
    matchKeys: [{ name: "byPhone", on: ["phone"] }],
    constraints: [{ kind: "unique", name: "phone_taken", on: ["phone"], refusal: "phone_taken" }],
}
const MEMBER: EntityDefinition = {
    entry: "entity",
    name: "sales.member",
    dataKind: "sales-member",
    fields: { title: { kind: "text", nullable: false, maxLength: 100 } },
}
const TASK: EntityDefinition = {
    entry: "entity",
    name: "sales.task",
    dataKind: "sales-task",
    fields: { title: { kind: "text", nullable: false, maxLength: 100 } },
    relations: { lead: { kind: "toOne", target: "sales.lead" } },
}
const ENTITIES = [LEAD, MEMBER, TASK]

const rawRecord = (id: string, data: Record<string, unknown>, version = "1") => ({
    id,
    workspace_id: WS,
    version,
    created_at: AT,
    updated_at: AT,
    data,
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
    data: { contactName: "An", phone: "0900" },
})

const pgError = (code: string, constraint?: string): Error =>
    Object.assign(new Error("pg failure"), constraint === undefined ? { code } : { code, constraint })

const LOCKS = {
    query: [
        [HASH_SQL, [{ hashtextextended: "123" }]],
        [LOCK_SQL, []],
    ],
} as const

const INSERT: Insert = { op: "insert", entity: "sales.lead", values: { contactName: "An" } }
const UPDATE: Mutation = {
    op: "update",
    entity: "sales.lead",
    key: LEAD_ID,
    expected: "3",
    values: { stage: "won" },
}
const DELETE: Delete = { op: "delete", entity: "sales.lead", key: LEAD_ID }
const LINK: Mutation = { op: "link", entity: "sales.lead", key: LEAD_ID, relation: "owner", to: OWNER_ID }
const UNLINK: Mutation = { op: "unlink", entity: "sales.lead", key: LEAD_ID, relation: "owner", to: OWNER_ID }

const build = async (em: MockEntityManager) => {
    fakeTransaction(em)
    const engine = mock<EntityEngineService>({ catalog: new Map(ENTITIES.map((entity) => [entity.name, entity])) })
    engine.definition.mockImplementation((name) => ENTITIES.find((entity) => entity.name === name) ?? LEAD)
    const failures = mock<EngineFailureService>()
    failures.fail.mockImplementation(() => {
        throw new EntityEngineError({ code: EntityEngineErrorCode.Failed })
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            EntityMutationService,
            { provide: EntityEngineService, useValue: engine },
            { provide: EngineFailureService, useValue: failures },
            {
                provide: ENTITY_ENGINE_OPTIONS,
                useValue: builder<EntityEngineOptions>({
                    entities: ENTITIES,
                    jobs: [],
                    cursorKey: new Secret("a2V5"),
                })(),
            },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: IDS, useValue: fakeIds() },
        ],
    }).compile()
    return { mutations: moduleRef.get(EntityMutationService), em, failures }
}

const ANY_FUNCTION: unknown = expect.any(Function)

const txOf = (manager: MockEntityManager): ScopedTx => mintScopedTx({ manager, workspaceId: WS })

describe("EntityMutationService insert", () => {
    it("inserts the record with a minted id, links its toOne relations and answers the record after it", async () => {
        const { mutations, em } = await build(mockEntityManager())
        const [insert, unlink, link] = queueQueryBuilders(em, [
            { execute: { raw: [rawRecord(NEW_ID, { contactName: "An", stage: "new" })] } },
            { execute: {} },
            { execute: {} },
        ])

        const result = await mutations.mutate(txOf(em), { ...INSERT, links: { owner: OWNER_ID } }, "action")

        expect(result).toEqual({ ok: true, row: rowOf(NEW_ID, { contactName: "An", stage: "new" }), version: "1" })
        expect(insert?.callsOf("values")).toEqual([
            [{ id: NEW_ID, workspaceId: WS, entity: "sales.lead", data: ANY_FUNCTION }],
        ])
        expect(insert?.callsOf("setParameter")).toEqual([["data", '{"stage":"new","contactName":"An"}']])
        expect(unlink?.callsOf("from")).toEqual([[RecordLinkEntity]])
        expect(link?.callsOf("values")).toEqual([
            [
                {
                    workspaceId: WS,
                    fromEntity: "sales.lead",
                    fromId: NEW_ID,
                    relation: "owner",
                    toEntity: "sales.member",
                    toId: OWNER_ID,
                },
            ],
        ])
    })

    it("inserts a record that has no links", async () => {
        const { mutations, em } = await build(mockEntityManager())
        queueQueryBuilders(em, [{ execute: { raw: [rawRecord(NEW_ID, { contactName: "An", stage: "new" })] } }])

        await expect(mutations.mutate(txOf(em), INSERT, "action")).resolves.toMatchObject({ ok: true })
    })

    it("refuses a mutation the catalog rejects, before any statement", async () => {
        const { mutations, em } = await build(mockEntityManager())
        const owned: Insert = { ...INSERT, values: { contactName: "An", workspaceId: WS } }

        await expect(mutations.mutate(txOf(em), owned, "action")).rejects.toMatchObject({
            code: EntityEngineErrorCode.MutationInvalid,
            params: { problem: "MUTATION_OWNER_FIELD", at: "sales.lead.workspaceId" },
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("EntityMutationService database failures", () => {
    const failing = async (error: Error) => {
        const built = await build(mockEntityManager())
        queueQueryBuilders(built.em, [{ execute: () => Promise.reject(error) }])
        return built
    }

    it("answers taken with the declared refusal when a declared unique constraint is violated", async () => {
        const { mutations, em } = await failing(pgError("23505", "records_sales_lead_phone_taken"))

        await expect(mutations.mutate(txOf(em), INSERT, "action")).resolves.toEqual({
            ok: false,
            reason: "taken",
            constraint: "phone_taken",
            refusal: "phone_taken",
        })
    })

    it("answers invalid with the constraint when a check refuses the value", async () => {
        const { mutations, em } = await failing(pgError("23514", "records_sales_lead_stage_chk"))

        await expect(mutations.mutate(txOf(em), INSERT, "action")).resolves.toEqual({
            ok: false,
            reason: "invalid",
            constraint: "records_sales_lead_stage_chk",
        })
    })

    it("answers invalid without a constraint when the error names none", async () => {
        const { mutations, em } = await failing(pgError("22P02"))

        await expect(mutations.mutate(txOf(em), INSERT, "action")).resolves.toEqual({
            ok: false,
            reason: "invalid",
        })
    })

    it("throws the engine error a failure the result cannot carry stands for", async () => {
        const cause = pgError("42501")
        const { mutations, em, failures } = await failing(cause)

        await expect(mutations.mutate(txOf(em), INSERT, "action")).rejects.toMatchObject({
            code: EntityEngineErrorCode.Failed,
        })
        expect(failures.fail).toHaveBeenCalledWith(cause, { kind: "scope" }, "sales.lead")
    })
})

describe("EntityMutationService update", () => {
    it("updates the record at the version the caller read", async () => {
        const { mutations, em } = await build(mockEntityManager())
        const [fake] = queueQueryBuilders(em, [
            { execute: { raw: [rawRecord(LEAD_ID, { contactName: "An", stage: "won" }, "4")] } },
        ])

        const result = await mutations.mutate(txOf(em), UPDATE, "action")

        expect(result).toEqual({
            ok: true,
            row: rowOf(LEAD_ID, { contactName: "An", stage: "won" }, "4"),
            version: "4",
        })
        expect(fake?.callsOf("where")).toEqual([[{ entity: "sales.lead", id: LEAD_ID, workspaceId: WS, version: "3" }]])
    })

    it("answers stale when the record exists at another version", async () => {
        const { mutations, em } = await build(mockEntityManager({ findOne: [RecordEntity, storedLead] }))
        queueQueryBuilders(em, [{ execute: { raw: [] } }])

        await expect(mutations.mutate(txOf(em), UPDATE, "action")).resolves.toEqual({
            ok: false,
            reason: "stale",
        })
    })

    it("answers missing when the record is not there", async () => {
        const { mutations, em } = await build(mockEntityManager({ findOne: [RecordEntity, null] }))
        queueQueryBuilders(em, [{ execute: { raw: [] } }])

        await expect(mutations.mutate(txOf(em), UPDATE, "action")).resolves.toEqual({
            ok: false,
            reason: "missing",
        })
    })
})

describe("EntityMutationService upsert and ensure", () => {
    const ENSURE: Mutation = {
        op: "ensure",
        entity: "sales.lead",
        match: "byPhone",
        values: { contactName: "An", phone: "0900" },
    }

    it("patches the record the unique constraint names and says it was not created", async () => {
        const { mutations, em } = await build(mockEntityManager(LOCKS))
        queueQueryBuilders(em, [
            { getOne: storedLead },
            { execute: { raw: [rawRecord(LEAD_ID, { contactName: "An", phone: "0900", stage: "won" }, "4")] } },
        ])

        const result = await mutations.mutate(
            txOf(em),
            { op: "upsert", entity: "sales.lead", on: "phone_taken", values: { contactName: "An", phone: "0900" } },
            "action",
        )

        expect(result).toMatchObject({ ok: true, version: "4", created: false })
    })

    it("answers the record the match key names without writing", async () => {
        const { mutations, em } = await build(mockEntityManager(LOCKS))
        queueQueryBuilders(em, [{ getOne: storedLead }])

        await expect(mutations.mutate(txOf(em), ENSURE, "job")).resolves.toMatchObject({
            ok: true,
            version: "3",
            created: false,
        })
    })

    it("inserts the record when the match key names none and says it was created", async () => {
        const { mutations, em } = await build(mockEntityManager(LOCKS))
        queueQueryBuilders(em, [
            { getOne: null },
            { execute: { raw: [rawRecord(NEW_ID, { contactName: "An", phone: "0900", stage: "new" })] } },
        ])

        await expect(mutations.mutate(txOf(em), ENSURE, "job")).resolves.toMatchObject({
            ok: true,
            version: "1",
            created: true,
        })
    })
})

describe("EntityMutationService delete", () => {
    const deletes = [{ execute: {} }, { execute: {} }, { execute: { raw: [{ id: LEAD_ID }] } }]

    it("deletes the record and answers it as it was", async () => {
        const { mutations, em } = await build(
            mockEntityManager({ findOne: [RecordEntity, storedLead], exists: [RecordLinkEntity, false] }),
        )
        queueQueryBuilders(em, deletes)

        await expect(mutations.mutate(txOf(em), DELETE, "action")).resolves.toEqual({
            ok: true,
            row: rowOf(LEAD_ID, { contactName: "An", phone: "0900" }, "3"),
            version: "3",
        })
    })

    it("deletes when the expected version still matches", async () => {
        const { mutations, em } = await build(
            mockEntityManager({ findOne: [RecordEntity, storedLead], exists: [RecordLinkEntity, false] }),
        )
        queueQueryBuilders(em, deletes)

        const result = await mutations.mutate(txOf(em), { ...DELETE, expected: "3" }, "action")

        expect(result.ok).toBe(true)
    })

    it("answers stale when the expected version moved, without deleting", async () => {
        const { mutations, em } = await build(mockEntityManager({ findOne: [RecordEntity, storedLead] }))

        await expect(mutations.mutate(txOf(em), { ...DELETE, expected: "2" }, "action")).resolves.toEqual({
            ok: false,
            reason: "stale",
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("answers missing when the record is not there", async () => {
        const { mutations, em } = await build(mockEntityManager({ findOne: [RecordEntity, null] }))

        await expect(mutations.mutate(txOf(em), DELETE, "action")).resolves.toEqual({
            ok: false,
            reason: "missing",
        })
    })

    it("answers invalid with the relation when a restricting relation still points at the record", async () => {
        const { mutations, em } = await build(
            mockEntityManager({ findOne: [RecordEntity, storedLead], exists: [RecordLinkEntity, true] }),
        )

        await expect(mutations.mutate(txOf(em), DELETE, "action")).resolves.toEqual({
            ok: false,
            reason: "invalid",
            constraint: "lead",
        })
    })

    it("answers missing when the record disappeared between the read and the delete", async () => {
        const { mutations, em } = await build(
            mockEntityManager({ findOne: [RecordEntity, storedLead], exists: [RecordLinkEntity, false] }),
        )
        queueQueryBuilders(em, [{ execute: {} }, { execute: {} }, { execute: { raw: [] } }])

        await expect(mutations.mutate(txOf(em), DELETE, "action")).resolves.toEqual({
            ok: false,
            reason: "missing",
        })
    })
})

describe("EntityMutationService link and unlink", () => {
    it("links the record to the target and answers the record", async () => {
        const { mutations, em } = await build(mockEntityManager({ findOne: [RecordEntity, storedLead] }))
        const [, insert] = queueQueryBuilders(em, [{ execute: {} }, { execute: {} }])

        const result = await mutations.mutate(txOf(em), LINK, "action")

        expect(result).toMatchObject({ ok: true, version: "3" })
        expect(insert?.callsOf("values")).toEqual([
            [
                {
                    workspaceId: WS,
                    fromEntity: "sales.lead",
                    fromId: LEAD_ID,
                    relation: "owner",
                    toEntity: "sales.member",
                    toId: OWNER_ID,
                },
            ],
        ])
    })

    it("answers invalid when the foreign key refuses a target that is not a record of the workspace", async () => {
        const { mutations, em } = await build(mockEntityManager({ findOne: [RecordEntity, storedLead] }))
        queueQueryBuilders(em, [
            { execute: {} },
            { execute: () => Promise.reject(pgError("23503", "record_links_to_fkey")) },
        ])

        await expect(mutations.mutate(txOf(em), LINK, "action")).resolves.toEqual({
            ok: false,
            reason: "invalid",
            constraint: "record_links_to_fkey",
        })
    })

    it("removes the link and answers the record", async () => {
        const { mutations, em } = await build(mockEntityManager({ findOne: [RecordEntity, storedLead] }))
        const [remove] = queueQueryBuilders(em, [{ execute: {} }])

        const result = await mutations.mutate(txOf(em), UNLINK, "action")

        expect(result).toMatchObject({ ok: true, version: "3" })
        expect(remove?.callsOf("where")).toEqual([
            [
                {
                    workspaceId: WS,
                    fromEntity: "sales.lead",
                    fromId: LEAD_ID,
                    relation: "owner",
                    toEntity: "sales.member",
                    toId: OWNER_ID,
                },
            ],
        ])
    })

    it("answers missing for a link or an unlink from a record that is not there", async () => {
        const { mutations, em } = await build(mockEntityManager({ findOne: [RecordEntity, null] }))

        await expect(mutations.mutate(txOf(em), LINK, "action")).resolves.toEqual({
            ok: false,
            reason: "missing",
        })
        await expect(mutations.mutate(txOf(em), UNLINK, "action")).resolves.toEqual({
            ok: false,
            reason: "missing",
        })
    })
})
