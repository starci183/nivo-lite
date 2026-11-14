import { defineEntity, defineRecordType, field } from "./entity"
import type { AnyEntityDefinition } from "./entity-any.types"
import { EntityDefinitionError } from "./entity-error"
import { entityProblems } from "./entity-problems"
import { entitiesDdlOf } from "./render-fresh"
import { manifestOf } from "./manifest"
import { expectedIndexes } from "./plan-expect"
import { fieldCheckSql, indexPieces } from "./render-ddl"
import { agentOfRecordType } from "./record-scope"
import type { EntityDefinition } from "./entity.types"

/*
 * The records frame of the owner (records.md): agent-scoped types, keys unique per workspace AND agent, refs to the same agent only,
 * a contact field linking the core contacts table, declared states.
 */

const order = defineEntity({
    name: "blocks-core.sales.order",
    dataKind: "sales-order",
    fields: {
        code: field.text({ maxLength: 20 }),
        customer: field.contact(),
        status: field.enum({ of: ["draft", "confirmed", "paid", "cancelled"] }),
    },
    constraints: [{ kind: "unique", name: "code_key", on: ["code"], refusal: "code_taken" }],
    indexes: [{ name: "status_key", on: ["status", "code"], unique: true }],
    states: { field: "status", initial: ["draft"], transitions: { draft: ["confirmed", "cancelled"], confirmed: ["paid", "cancelled"] } },
})

const lead = defineEntity({
    name: "blocks-core.sales.lead",
    dataKind: "sales-lead",
    fields: { name: field.text({ maxLength: 40 }), person: field.contact({ nullable: true, onContactDelete: "clear" }) },
})

const chat = defineEntity({ name: "blocks-core.chatbot.chat", dataKind: "chat", fields: { title: field.text({ maxLength: 40 }) } })

const catalogOf = (...entities: ReadonlyArray<AnyEntityDefinition>): ReadonlyMap<string, AnyEntityDefinition> =>
    new Map(entities.map((entity) => [entity.name, entity]))

const thrown = (make: () => unknown): unknown => {
    try {
        make()
    } catch (error) {
        return error
    }
    return null
}

describe("the agent of a record type", () => {
    it("reads the agent of a type from its name", () => {
        expect(agentOfRecordType("blocks-core.sales.order")).toBe("sales")
        expect(agentOfRecordType("nivo-web-core.webbooks.invoice")).toBe("webbooks")
        expect(agentOfRecordType("loyalty.member")).toBe("loyalty")
    })
})

describe("defineRecordType", () => {
    it("is the same builder as defineEntity", () => {
        expect(defineRecordType).toBe(defineEntity)
    })
})

describe("refs to the same agent only", () => {
    it("accepts a ref to a type of the same agent", () => {
        const withRef = { ...order, relations: { lead: { kind: "toOne", target: lead.name } } } as const
        expect(entityProblems(withRef, catalogOf(withRef, lead)).map((problem) => problem.code)).toEqual([])
    })

    it("reports RECORD_REF_OTHER_AGENT for a ref to another agent's type", () => {
        const crossing = { ...order, relations: { chat: { kind: "toOne", target: chat.name } } } as const
        expect(entityProblems(crossing, catalogOf(crossing, chat))).toEqual([
            { code: "RECORD_REF_OTHER_AGENT", entity: order.name, at: "relations.chat" },
        ])
    })
})

describe("field.contact", () => {
    it("is a non-nullable contact id that erases by default", () => {
        expect(field.contact()).toEqual({ kind: "contact", nullable: false })
        expect(field.contact({ nullable: true, onContactDelete: "clear" })).toEqual({
            kind: "contact",
            nullable: true,
            onContactDelete: "clear",
        })
    })

    it("refuses `clear` on a field that cannot be null, and onContactDelete on another kind", () => {
        const at = (fields: AnyEntityDefinition["fields"]): unknown =>
            thrown(() => defineEntity({ name: "blocks-core.sales.bad", dataKind: "bad", fields }))
        expect(at({ who: { kind: "contact", nullable: false, onContactDelete: "clear" } })).toBeInstanceOf(EntityDefinitionError)
        expect(at({ who: { kind: "uuid", nullable: true, onContactDelete: "erase" } })).toMatchObject({
            code: "ENTITY_CONTACT_INVALID",
        })
        expect(at({ who: { kind: "contact", nullable: false, default: "uuid" } })).toMatchObject({
            code: "ENTITY_CONTACT_INVALID",
        })
    })

    it("is checked as a uuid by the partition CHECK", () => {
        expect(fieldCheckSql("customer", { kind: "contact", nullable: false })).toContain(
            "(data->>'customer') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'",
        )
    })

    it("gets the index the contact erase and the contact filter read by", () => {
        expect(expectedIndexes(order).find((index) => index.name === "records_blocks_core_sales_order_customer_contact_idx")).toEqual({
            name: "records_blocks_core_sales_order_customer_contact_idx",
            parts: ["workspace_id", "data->>'customer'"],
            unique: false,
            method: "btree",
            partial: false,
            constraint: false,
        })
        expect(
            indexPieces(order).find((piece) => piece.name === "records_blocks_core_sales_order_customer_contact_idx")?.statements,
        ).toEqual([
            `CREATE INDEX "records_blocks_core_sales_order_customer_contact_idx" ON public."records_blocks_core_sales_order" USING btree (workspace_id, ((data->>'customer')::uuid))`,
        ])
        expect(manifestOf([order]).entities[0]?.indexes).toContain("records_blocks_core_sales_order_customer_contact_idx")
    })
})

describe("a key is unique per workspace AND agent", () => {
    const uniqueParts = (entity: EntityDefinition): ReadonlyArray<ReadonlyArray<string>> =>
        expectedIndexes(entity)
            .filter((index) => index.unique)
            .map((index) => index.parts)

    it("puts agent_id after the workspace in every unique of an agent-scoped type", () => {
        expect(uniqueParts(order)).toEqual([
            ["workspace_id", "agent_id", "data->>'status'", "data->>'code'"],
            ["workspace_id", "agent_id", "data->>'code'"],
        ])
        expect(indexPieces(order).find((piece) => piece.name === "records_blocks_core_sales_order_code_key")?.statements).toEqual([
            `CREATE UNIQUE INDEX "records_blocks_core_sales_order_code_key" ON public."records_blocks_core_sales_order" USING btree (workspace_id, agent_id, (data->>'code')) WHERE deleted_at IS NULL`,
        ])
    })
})

describe("declared states", () => {
    it("keeps the declaration frozen", () => {
        expect(Object.isFrozen(order.states)).toBe(true)
        expect(Object.isFrozen(order.states?.transitions)).toBe(true)
    })

    it("refuses states on a field that is no enum, or a state the enum does not hold", () => {
        const statesOf = (states: NonNullable<AnyEntityDefinition["states"]>): unknown =>
            thrown(() =>
                defineEntity({
                    name: "blocks-core.sales.bad",
                    dataKind: "bad",
                    fields: { status: field.enum({ of: ["a", "b"] }), note: field.text({ maxLength: 4 }) },
                    states,
                }),
            )
        expect(statesOf({ field: "note", transitions: {} })).toMatchObject({ code: "ENTITY_STATES_INVALID" })
        expect(statesOf({ field: "ghost", transitions: {} })).toMatchObject({ code: "ENTITY_STATES_INVALID" })
        expect(statesOf({ field: "status", transitions: { a: ["c"] } })).toMatchObject({ code: "ENTITY_STATES_INVALID" })
        expect(statesOf({ field: "status", initial: ["c"], transitions: {} })).toMatchObject({ code: "ENTITY_STATES_INVALID" })
        expect(statesOf({ field: "status", initial: ["a"], transitions: { a: ["b"] } })).toBeNull()
    })
})

describe("entitiesDdlOf: the DDL a fresh database gets from the declarations", () => {
    it("is deterministic and carries every partition, check and index, the agent in the uniques", () => {
        const ddl = entitiesDdlOf([order, lead])
        expect(ddl).toBe(entitiesDdlOf([lead, order]))
        expect(ddl).toContain(
            `CREATE TABLE public."records_blocks_core_sales_order" PARTITION OF public.records FOR VALUES IN ('blocks-core.sales.order');`,
        )
        expect(ddl).toContain(`USING btree (workspace_id, agent_id, (data->>'code')) WHERE deleted_at IS NULL;`)
        expect(ddl).not.toContain("CREATE POLICY")
    })

    it("gives every partition agent_id NOT NULL and a foreign key to the agents that cascades: an agent's records die with it", () => {
        const ddl = entitiesDdlOf([order, lead])
        for (const partition of ["records_blocks_core_sales_order", "records_blocks_core_sales_lead"]) {
            expect(ddl).toContain(
                `ALTER TABLE public."${partition}" ADD CONSTRAINT "${partition}_agent_scope_chk" CHECK (agent_id IS NOT NULL) NOT VALID;`,
            )
            expect(ddl).toContain(`ALTER TABLE public."${partition}" VALIDATE CONSTRAINT "${partition}_agent_scope_chk";`)
            expect(ddl).toContain(
                `ALTER TABLE public."${partition}" ADD CONSTRAINT "${partition}_agent_fk" FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE NOT VALID;`,
            )
            expect(ddl).toContain(`ALTER TABLE public."${partition}" VALIDATE CONSTRAINT "${partition}_agent_fk";`)
        }
        expect(ddl).not.toContain("ON DELETE SET NULL")
        expect(ddl.endsWith("\n")).toBe(true)
    })
})
