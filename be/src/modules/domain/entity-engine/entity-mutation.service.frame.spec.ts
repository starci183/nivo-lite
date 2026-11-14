import { Test } from "@nestjs/testing"
import { builder, fakeIds, fakeTransaction, FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { IDS } from "@modules/platform/ids"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { Insert, Mutation } from "@nivo-lite/agent-sdk/mutation"
import { EngineFailureService } from "./engine-failure.service"
import { ENTITY_ENGINE_OPTIONS } from "./entity-engine.decorators"
import type { EntityEngineOptions } from "./entity-engine.options"
import { EntityEngineService } from "./entity-engine.service"
import { EntityMutationService } from "./entity-mutation.service"
import { EntityEngineErrorCode } from "./errors/entity-engine.error"
import { RecordEntity } from "./persistence/entities"
import type { ScopedTx } from "./policies/scoped-tx.contracts"
import { mintScopedTx } from "./policies/scoped-tx.policy"
import { RECORD_CONTACTS } from "./record-contacts.port"
import type { RecordContactsPort } from "./record-contacts.port"

/** Matches the soft-delete guard TypeORM's `IsNull()` puts on `deletedAt`. */
const IS_NULL: unknown = expect.objectContaining({ _type: "isNull" })

const WS = "11111111-1111-4111-8111-111111111111"
const AGENT = "22222222-2222-4222-8222-222222222222"
const CONTACT = "33333333-3333-4333-8333-333333333333"
const SURVIVOR = "55555555-5555-4555-8555-555555555555"
const ORDER_ID = "66666666-6666-4666-8666-666666666666"
const NEW_ID = "00000000-0000-4000-8000-000000000001"
const AT = new Date("2026-11-13T10:00:00.000Z")

/** An order of the sales agent: its customer is a contact (erased with them), its status moves along declared transitions. */
const ORDER: EntityDefinition = {
    entry: "entity",
    name: "blocks-core.sales.order",
    dataKind: "sales-order",
    fields: {
        code: { kind: "text", nullable: false, maxLength: 20 },
        customer: { kind: "contact", nullable: false },
        status: { kind: "enum", nullable: false, of: ["draft", "confirmed", "paid"] },
        receipt: { kind: "file", nullable: true, accept: ["image/*"], maxBytes: 1000 },
    },
    states: { field: "status", initial: ["draft"], transitions: { draft: ["confirmed"], confirmed: ["paid"] } },
    constraints: [{ kind: "unique", name: "code_key", on: ["code"], refusal: "code_taken" }],
    matchKeys: [{ name: "code", on: ["code"] }],
    relations: { lead: { kind: "toOne", target: "blocks-core.sales.lead" } },
    deletable: true,
}

/** A lead of the sales agent whose referrer is a contact cleared (not erased) with them. */
const LEAD: EntityDefinition = {
    entry: "entity",
    name: "blocks-core.sales.lead",
    dataKind: "sales-lead",
    fields: { referrer: { kind: "contact", nullable: true, onContactDelete: "clear" } },
}

/** One of the engine's own bookkeeping types. */

const ENTITIES = [ORDER, LEAD]

const rawRecord = (id: string, data: Record<string, unknown>, version = "1") => ({
    id,
    workspace_id: WS,
    version,
    created_at: AT,
    updated_at: AT,
    data,
})

const stored = (entity: string, id: string, data: Record<string, unknown>, version = "1"): RecordEntity =>
    Object.assign(new RecordEntity(), {
        entity,
        id,
        workspaceId: WS,
        version,
        createdAt: AT,
        updatedAt: AT,
        data,
        agentId: AGENT,
    })

const build = async (em: MockEntityManager, contacts?: RecordContactsPort) => {
    fakeTransaction(em)
    const engine = mock<EntityEngineService>({ catalog: new Map(ENTITIES.map((entity) => [entity.name, entity])) })
    engine.definition.mockImplementation((name) => ENTITIES.find((entity) => entity.name === name) ?? ORDER)
    engine.scoped.mockImplementation((workspaceId, work) => work(mintScopedTx({ manager: em, workspaceId })))
    const moduleRef = await Test.createTestingModule({
        providers: [
            EntityMutationService,
            { provide: EntityEngineService, useValue: engine },
            { provide: EngineFailureService, useValue: mock<EngineFailureService>() },
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
            ...(contacts === undefined
                ? []
                : [{ provide: RECORD_CONTACTS, useValue: mock<RecordContactsPort>(contacts) }]),
        ],
    }).compile()
    return moduleRef.get(EntityMutationService)
}

const agentTx = (manager: MockEntityManager): ScopedTx =>
    mintScopedTx({ manager, workspaceId: WS, agent: { id: AGENT, sees: "own" } })

const contactsOf = (current: ReadonlyMap<string, string>): RecordContactsPort => ({
    currentOf: jest.fn(() => Promise.resolve(current)),
    aliasesOf: jest.fn(() => Promise.resolve(new Map())),
})

const INSERT: Insert = { op: "insert", entity: ORDER.name, values: { code: "A1", customer: CONTACT, status: "draft" } }

describe("records are agents' only", () => {
    it("refuses a write of an agent-scoped type in a scope no agent is behind, before any statement", async () => {
        const em = mockEntityManager()
        const mutations = await build(em, contactsOf(new Map([[CONTACT, CONTACT]])))

        await expect(
            mutations.mutate(mintScopedTx({ manager: em, workspaceId: WS }), INSERT, "job"),
        ).rejects.toMatchObject({
            code: EntityEngineErrorCode.AgentMissing,
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("no write of any kind exists without an agent", () => {
    const WRITES: ReadonlyArray<Mutation> = [
        INSERT,
        { op: "update", entity: ORDER.name, key: ORDER_ID, expected: "1", values: { status: "confirmed" } },
        {
            op: "upsert",
            entity: ORDER.name,
            on: "code_key",
            values: { code: "A1", customer: CONTACT, status: "draft" },
        },
        { op: "ensure", entity: ORDER.name, match: "code", values: { code: "A1", customer: CONTACT, status: "draft" } },
        { op: "delete", entity: ORDER.name, key: ORDER_ID },
        { op: "link", entity: ORDER.name, key: ORDER_ID, relation: "lead", to: NEW_ID },
        { op: "unlink", entity: ORDER.name, key: ORDER_ID, relation: "lead", to: NEW_ID },
    ]

    it.each(WRITES.map((write) => [write.op, write] as const))(
        "refuses %s in a scope no agent is behind (AgentMissing), before any statement",
        async (_op, write) => {
            const em = mockEntityManager()
            const mutations = await build(em, contactsOf(new Map([[CONTACT, CONTACT]])))

            await expect(
                mutations.mutate(mintScopedTx({ manager: em, workspaceId: WS }), write, "job"),
            ).rejects.toMatchObject({
                code: EntityEngineErrorCode.AgentMissing,
            })
            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        },
    )
})

describe("a contact field names a core contact", () => {
    it("stores the id the contact stands for now (the survivor of a merge)", async () => {
        const em = mockEntityManager()
        const contacts = contactsOf(new Map([[CONTACT, SURVIVOR]]))
        const mutations = await build(em, contacts)
        const [insert] = queueQueryBuilders(em, [
            { execute: { raw: [rawRecord(NEW_ID, { code: "A1", customer: SURVIVOR, status: "draft" })] } },
        ])

        await expect(mutations.mutate(agentTx(em), INSERT, "action")).resolves.toMatchObject({ ok: true })
        expect(contacts.currentOf).toHaveBeenCalledWith(WS, [CONTACT])
        expect(insert?.callsOf("setParameter")).toEqual([
            ["data", `{"code":"A1","customer":"${SURVIVOR}","status":"draft"}`],
        ])
    })

    it("refuses (`invalid` at the field) a contact the workspace does not hold, before any statement", async () => {
        const em = mockEntityManager()
        const mutations = await build(em, contactsOf(new Map()))

        await expect(mutations.mutate(agentTx(em), INSERT, "action")).resolves.toEqual({
            ok: false,
            reason: "invalid",
            constraint: "customer",
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("refuses a contact value when no contacts port is bound: it cannot be proven", async () => {
        const em = mockEntityManager()
        const mutations = await build(em)

        await expect(mutations.mutate(agentTx(em), INSERT, "action")).resolves.toEqual({
            ok: false,
            reason: "invalid",
            constraint: "customer",
        })
    })
})

describe("declared states", () => {
    const moving = (status: string, expected = "1"): Mutation => ({
        op: "update",
        entity: ORDER.name,
        key: ORDER_ID,
        expected,
        values: { status },
    })

    it("refuses an insert that does not start in a declared initial state", async () => {
        const em = mockEntityManager()
        const mutations = await build(em, contactsOf(new Map([[CONTACT, CONTACT]])))

        await expect(
            mutations.mutate(agentTx(em), { ...INSERT, values: { ...INSERT.values, status: "paid" } }, "action"),
        ).resolves.toEqual({ ok: false, reason: "invalid", constraint: "status_transition" })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("refuses a move along no declared transition, and writes nothing", async () => {
        const em = mockEntityManager({ findOne: [RecordEntity, stored(ORDER.name, ORDER_ID, { status: "draft" })] })
        const mutations = await build(em)

        await expect(mutations.mutate(agentTx(em), moving("paid"), "action")).resolves.toEqual({
            ok: false,
            reason: "invalid",
            constraint: "status_transition",
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("moves along a declared transition at the version it read; a moved version is stale", async () => {
        const em = mockEntityManager({
            findOne: [RecordEntity, stored(ORDER.name, ORDER_ID, { status: "draft" }, "4")],
        })
        const mutations = await build(em)
        const [update] = queueQueryBuilders(em, [
            { execute: { raw: [rawRecord(ORDER_ID, { status: "confirmed" }, "5")] } },
        ])

        await expect(mutations.mutate(agentTx(em), moving("confirmed", "4"), "action")).resolves.toMatchObject({
            ok: true,
            version: "5",
        })
        expect(update?.callsOf("where")).toEqual([
            [{ entity: ORDER.name, id: ORDER_ID, workspaceId: WS, deletedAt: IS_NULL, agentId: AGENT, version: "4" }],
        ])
        await expect(mutations.mutate(agentTx(em), moving("confirmed", "3"), "action")).resolves.toEqual({
            ok: false,
            reason: "stale",
        })
    })
})

describe("eraseForContacts: deleting a contact erases every record of an erase field and keeps a clear field's record untouched", () => {
    // DEF-6 (MX D-01): the erase REWROTE the kept records' contact field to null (the sales orders lost their person, and a credit then
    // paid an erased person's order as anyone's). R31: an erasure never rewrites a record; the reference stays and reads through the
    // erased contact find nothing (RecordContactsAdapter.aliasesOf).
    it("soft-deletes the records of an erase field (their files stay: none handed back), keeps the records of a clear field AS THEY ARE, in one transaction", async () => {
        const receipt = {
            key: `${WS}/blocks-core.sales.order/${ORDER_ID}/receipt/o-1`,
            mime: "image/png",
            size: 3,
            name: "r.png",
        }
        const order = stored(ORDER.name, ORDER_ID, { code: "A1", customer: CONTACT, status: "paid", receipt })
        const lead = stored(LEAD.name, "l-1", { referrer: CONTACT })
        const em = mockEntityManager({ findOne: [RecordEntity, order] })
        const mutations = await build(em)
        const [orders, leads, removal, clear] = queueQueryBuilders(em, [
            { getMany: [order] },
            { getMany: [lead] },
            { execute: { raw: [{ id: ORDER_ID }] } },
            { execute: { raw: [rawRecord("l-1", { referrer: null }, "2")] } },
        ])

        await expect(mutations.eraseForContacts(WS, [CONTACT])).resolves.toEqual({
            kind: "erased",
            erased: 1,
            cleared: 1,
            files: [],
        })
        expect(orders?.callsOf("where")).toEqual([
            ["r.entity = :entity AND r.workspaceId = :ws", { entity: ORDER.name, ws: WS }],
        ])
        expect(leads?.callsOf("where")).toEqual([
            ["r.entity = :entity AND r.workspaceId = :ws", { entity: LEAD.name, ws: WS }],
        ])
        expect(removal?.callsOf("where")).toEqual([
            [{ entity: ORDER.name, id: ORDER_ID, workspaceId: WS, deletedAt: IS_NULL }],
        ])
        expect(removal?.callsOf("delete")).toEqual([])
        // No write to the kept record: its reference to the erased person stays.
        expect(clear?.callsOf("setParameter")).toEqual([])
        expect(clear?.callsOf("execute")).toEqual([])
    })
})

describe("a delete is a soft delete confined to the calling agent", () => {
    it("answers missing for a record of another agent and writes nothing: the read that proves the record is confined to the scope's agent", async () => {
        const em = mockEntityManager({ findOne: [RecordEntity, null] })
        const mutations = await build(em)

        await expect(
            mutations.mutate(agentTx(em), { op: "delete", entity: ORDER.name, key: ORDER_ID }, "action"),
        ).resolves.toEqual({
            ok: false,
            reason: "missing",
        })
        expect(em.findOne).toHaveBeenCalledWith(RecordEntity, {
            where: { entity: ORDER.name, id: ORDER_ID, workspaceId: WS, agentId: AGENT },
        })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        expect(em.delete).not.toHaveBeenCalled()
    })
})
