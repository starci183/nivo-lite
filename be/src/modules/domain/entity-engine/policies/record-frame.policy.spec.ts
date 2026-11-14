import { mockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { FilterExpr } from "@nivo-lite/agent-sdk/query"
import { EntityEngineErrorCode } from "../errors/entity-engine.error"
import { contactFilterOf, contactFilterValuesOf, contactIdsOf, filesOf, withCurrentContacts } from "./contact-values.policy"
import { findRecordByFields } from "./find-by-fields.policy"
import { keyAgentOf, requireAgentScope } from "./record-scope.policy"
import { mintScopedTx } from "./scoped-tx.policy"
import { insertStateRefusal, updateStateRefusal } from "./state-transition.policy"
import { causeFactsOf } from "@tests/fixtures/builders/cause-facts.builder"

const WS = "11111111-1111-4111-8111-111111111111"
const AGENT = "22222222-2222-4222-8222-222222222222"
const C1 = "33333333-3333-4333-8333-333333333333"
const C2 = "44444444-4444-4444-8444-444444444444"
const C0 = "55555555-5555-4555-8555-555555555555"

const ORDER: EntityDefinition = {
    entry: "entity",
    name: "blocks-core.sales.order",
    dataKind: "sales-order",
    fields: {
        code: { kind: "text", nullable: false, maxLength: 20 },
        customer: { kind: "contact", nullable: false },
        payer: { kind: "contact", nullable: true, onContactDelete: "clear" },
        status: { kind: "enum", nullable: false, of: ["draft", "confirmed", "paid", "cancelled"] },
        receipt: { kind: "file", nullable: true, accept: ["image/*"], maxBytes: 1000 },
    },
    states: { field: "status", initial: ["draft"], transitions: { draft: ["confirmed", "cancelled"], confirmed: ["paid"] } },
}

const { states: _states, ...STATELESS_PARTS } = ORDER
const STATELESS: EntityDefinition = STATELESS_PARTS

const rowOf = (data: Record<string, unknown>) => ({
    id: "r-1",
    workspaceId: WS,
    version: "2",
    createdAt: "2026-11-13T00:00:00.000Z",
    updatedAt: "2026-11-13T00:00:00.000Z",
    data,
})

/** The `code` of the error a call throws, or undefined when it throws nothing. */
const codeThrownBy = (work: () => unknown): unknown => {
    try {
        work()
    } catch (cause) {
        return causeFactsOf(cause).code
    }
    return undefined
}

describe("requireAgentScope: no record of an agent type is written without an agent", () => {
    it("refuses a scope with no agent for an agent-scoped type, with the typed AgentMissing", () => {
        const tx = mintScopedTx({ manager: mockEntityManager(), workspaceId: WS })
        expect(codeThrownBy(() => requireAgentScope(tx, ORDER.name))).toBe(EntityEngineErrorCode.AgentMissing)
    })

    it("lets an agent's scope write", () => {
        const scoped = mintScopedTx({ manager: mockEntityManager(), workspaceId: WS, agent: { id: AGENT, sees: "all" } })
        expect(() => requireAgentScope(scoped, ORDER.name)).not.toThrow()
    })
})

describe("keyAgentOf: a declared key is looked up inside the agent that writes", () => {
    it("is the stamped agent for an agent type even when the scope sees every record", () => {
        const all = mintScopedTx({ manager: mockEntityManager(), workspaceId: WS, agent: { id: AGENT, sees: "all" } })
        expect(keyAgentOf(all)).toBe(AGENT)
        const own = mintScopedTx({ manager: mockEntityManager(), workspaceId: WS, agent: { id: AGENT, sees: "own" } })
        expect(keyAgentOf(own)).toBe(AGENT)
    })

    it("is none for a scope with no agent", () => {
        expect(keyAgentOf(mintScopedTx({ manager: mockEntityManager(), workspaceId: WS }))).toBeNull()
    })
})

describe("findRecordByFields: an upsert or ensure never matches another agent's record", () => {
    it("adds the writing agent to the key lookup of an agent type in a scope that sees every record", async () => {
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [{ getOne: null }])
        const tx = mintScopedTx({ manager: em, workspaceId: WS, agent: { id: AGENT, sees: "all" } })

        await findRecordByFields(tx, new Map([[ORDER.name, ORDER]]), ORDER, [["code", "A1"]])

        expect(fake?.callsOf("andWhere")[0]).toEqual(["r.agentId = :agent", { agent: AGENT }])
    })
})

describe("declared states", () => {
    it("lets an insert start only in an initial state", () => {
        expect(insertStateRefusal(ORDER, { status: "draft" })).toBeNull()
        expect(insertStateRefusal(ORDER, { status: "paid" })).toBe("status_transition")
        expect(insertStateRefusal({ ...ORDER, states: { field: "status", transitions: {} } }, { status: "paid" })).toBeNull()
    })

    it("lets an update move only along a declared transition, or stay", () => {
        expect(updateStateRefusal(ORDER, rowOf({ status: "draft" }), { status: "confirmed" })).toBeNull()
        expect(updateStateRefusal(ORDER, rowOf({ status: "draft" }), { status: "draft" })).toBeNull()
        expect(updateStateRefusal(ORDER, rowOf({ status: "draft" }), { status: "paid" })).toBe("status_transition")
        expect(updateStateRefusal(ORDER, rowOf({ status: "paid" }), { status: "draft" })).toBe("status_transition")
        expect(updateStateRefusal(ORDER, rowOf({ status: "draft" }), { code: "B2" })).toBeNull()
        expect(updateStateRefusal(STATELESS, rowOf({}), { status: "paid" })).toBeNull()
    })
})

describe("contact fields", () => {
    it("reads the contact ids a write names", () => {
        expect(contactIdsOf(ORDER, { code: "A", customer: C1, payer: null })).toEqual([C1])
        expect(contactIdsOf(ORDER, { customer: C1, payer: C2 })).toEqual([C1, C2])
    })

    it("stores the id each contact stands for now, and names the first field whose contact the workspace does not hold", () => {
        const current = new Map([
            [C1, C0],
            [C2, C2],
        ])
        expect(withCurrentContacts(ORDER, { code: "A", customer: C1, payer: C2 }, current)).toEqual({
            ok: true,
            contacts: { customer: C0, payer: C2 },
        })
        expect(withCurrentContacts(ORDER, { customer: "66666666-6666-4666-8666-666666666666" }, current)).toEqual({
            ok: false,
            field: "customer",
        })
    })

    it("follows a merge at read time: a filter on a contact field matches every id merged into the contact", () => {
        const where: FilterExpr = {
            op: "and",
            of: [
                { op: "eq", field: "customer", value: C0 },
                { op: "eq", field: "code", value: "A" },
                { op: "in", field: "payer", values: [C2] },
            ],
        }
        expect(contactFilterValuesOf(ORDER, where)).toEqual([C0, C2])
        expect(
            contactFilterOf(
                ORDER,
                where,
                new Map([
                    [C0, [C0, C1]],
                    [C2, [C2]],
                ]),
            ),
        ).toEqual({
            op: "and",
            of: [
                { op: "in", field: "customer", values: [C0, C1] },
                { op: "eq", field: "code", value: "A" },
                { op: "in", field: "payer", values: [C2] },
            ],
        })
    })

    it("reads the stored file objects of a record, so an erased record's files are removed with it", () => {
        expect(filesOf(ORDER, { receipt: { key: "ws/x/r/receipt/o", mime: "image/png", size: 3, name: "a.png" } })).toEqual([
            "ws/x/r/receipt/o",
        ])
        expect(filesOf(ORDER, { receipt: null })).toEqual([])
    })

    it("reads every object of a list file field, in order, so an erased record's photos are removed with it", () => {
        const photos = defineEntity({
            name: "fixture.photo-set",
            dataKind: "fixture-photo-set",
            fields: { photos: field.file({ accept: ["image/*"], maxBytes: 100, many: true, max: 3 }) },
        })
        const item = (n: number) => ({ key: `ws/x/r/photos/o${n}`, mime: "image/png", size: 3, name: `p${n}.png` })

        expect(filesOf(photos, { photos: [item(2), item(1)] })).toEqual(["ws/x/r/photos/o2", "ws/x/r/photos/o1"])
        expect(filesOf(photos, { photos: [] })).toEqual([])
    })
})
