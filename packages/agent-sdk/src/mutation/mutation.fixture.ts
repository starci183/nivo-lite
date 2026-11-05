import { z } from "../schema/zod-entry"
import type { AnyEntityDefinition } from "../entity/entity-any.types"

/** An entity of the demo module that exercises every field kind a mutation writes, a toOne relation (required and optional) and a toMany. */
export const leadEntity: AnyEntityDefinition = {
    entry: "entity",
    name: "demo.lead",
    dataKind: "demo-lead",
    fields: {
        name: { kind: "text", nullable: false, maxLength: 10 },
        phone: { kind: "text", nullable: true, maxLength: 20 },
        stage: { kind: "enum", nullable: false, of: ["new", "won"], default: { literal: "new" } },
        orderNo: { kind: "sequence", nullable: false, format: "DH-{n:5}" },
        amount: { kind: "money_vnd", nullable: true },
        count: { kind: "int", nullable: true },
        big: { kind: "bigint", nullable: true },
        flag: { kind: "bool", nullable: true },
        day: { kind: "date", nullable: true },
        at: { kind: "timestamptz", nullable: true },
        ref: { kind: "uuid", nullable: true },
        data: { kind: "jsonb", nullable: true, shape: z.object({ tag: z.string().max(5) }) },
        loose: { kind: "jsonb", nullable: true },
        broken: { kind: "enum", nullable: true },
    },
    relations: {
        owner: { kind: "toOne", target: "demo.member", required: true },
        source: { kind: "toOne", target: "demo.member" },
        notes: { kind: "toMany", target: "demo.note" },
    },
    constraints: [
        { kind: "check", name: "lead_name_check", expr: { op: "notNull", field: "name" }, refusal: "name" },
        { kind: "unique", name: "lead_phone", on: ["phone"], refusal: "phone taken" },
    ],
    matchKeys: [{ name: "by_phone", on: ["phone"] }],
}

/** A deletable entity with a `status` enum: a saga run state. */
export const runEntity: AnyEntityDefinition = {
    entry: "entity",
    name: "demo.run",
    dataKind: "demo-run",
    fields: { status: { kind: "enum", nullable: false, of: ["running", "done"] } },
    deletable: true,
}

/** An entity whose `status` is not an enum. */
export const textStatusEntity: AnyEntityDefinition = {
    entry: "entity",
    name: "demo.textstatus",
    dataKind: "demo-textstatus",
    fields: { status: { kind: "text", nullable: false, maxLength: 10 } },
}

/** An entity with no `status` at all. */
export const bareEntity: AnyEntityDefinition = { entry: "entity", name: "demo.bare", dataKind: "demo-bare", fields: {} }

/** A projection entity: only a job writes it. */
export const bookEntity: AnyEntityDefinition = {
    entry: "entity",
    name: "demo.book",
    dataKind: "demo-book",
    fields: { note: { kind: "text", nullable: true, maxLength: 20 } },
    projection: { sources: ["demo.lead"] },
}

export const entities: ReadonlyArray<AnyEntityDefinition> = [
    leadEntity,
    runEntity,
    bareEntity,
    textStatusEntity,
    bookEntity,
]

export const LEAD_ID = "5b0c3e1a-6c27-4a92-8d40-2a6f0f7a9b10"
export const MEMBER_ID = "0d9e5a64-3f6a-4f0b-9a54-3d1a7a0b8c11"
export const VERSION = "42"
