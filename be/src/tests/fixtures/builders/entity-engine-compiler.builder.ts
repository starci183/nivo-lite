import type { EntityDefinition, FieldDef, SequenceDate } from "@nivo-lite/agent-sdk/entity"

/** The declared shape of the lead's custom attributes: a double that parses to what it is given. */
export type MetaShape = NonNullable<FieldDef["shape"]>

/** The workspace the compiler specs scope their statements to. */
export const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111"

/** A deletable entity with every field kind the compiler reads and writes, two relations and one match key. */
export const leadEntityOf = (meta: MetaShape): EntityDefinition => ({
    entry: "entity",
    name: "sales.lead",
    dataKind: "sales-lead",
    deletable: true,
    fields: {
        contactName: { kind: "text", nullable: false, maxLength: 200, searchable: true },
        phone: { kind: "text", nullable: true, maxLength: 30 },
        stage: { kind: "enum", nullable: false, of: ["new", "won"], default: { literal: "new" } },
        amount: { kind: "int", nullable: true },
        total: { kind: "bigint", nullable: true },
        paid: { kind: "bool", nullable: true },
        closedAt: { kind: "timestamptz", nullable: true },
        dueOn: { kind: "date", nullable: true },
        ownerRef: { kind: "uuid", nullable: true },
        price: { kind: "money_vnd", nullable: true },
        seenAt: { kind: "timestamptz", nullable: false, default: "now" },
        token: { kind: "uuid", nullable: false, default: "uuid" },
        note: { kind: "text", nullable: false, maxLength: 100, default: "empty" },
        meta: {
            kind: "jsonb",
            nullable: false,
            shape: meta,
            default: "empty",
            keys: { score: { kind: "int", filter: true, sort: true }, label: { kind: "text", filter: true } },
        },
        code: { kind: "sequence", nullable: false, format: "DH-{yyyy}-{n:5}", resets: "year" },
        ticket: { kind: "sequence", nullable: false, format: "T{n:4}" },
        bare: { kind: "jsonb", nullable: true },
    },
    relations: {
        owner: { kind: "toOne", target: "sales.member" },
        tasks: { kind: "toMany", target: "sales.task" },
    },
    matchKeys: [{ name: "byPhone", on: ["phone"] }],
    constraints: [
        {
            kind: "check",
            name: "amount_positive",
            expr: { op: "gte", field: "amount", value: 0 },
            refusal: "amount_negative",
        },
        { kind: "unique", name: "phone_taken", on: ["phone"], refusal: "phone_taken" },
    ],
})

const plainEntity = (name: `${string}.${string}`, relations: EntityDefinition["relations"]): EntityDefinition => ({
    entry: "entity",
    name,
    dataKind: name.replace(".", "-"),
    fields: { title: { kind: "text", nullable: false, maxLength: 100 }, at: { kind: "timestamptz", nullable: true } },
    ...(relations === undefined ? {} : { relations }),
})

/** The entities of the compiler specs: leads, their owners, their tasks (restrict) and their notes (cascade). */
export const entityCatalogOf = (meta: MetaShape): ReadonlyMap<string, EntityDefinition> =>
    new Map<string, EntityDefinition>([
        ["sales.lead", leadEntityOf(meta)],
        ["sales.member", plainEntity("sales.member", undefined)],
        ["sales.task", plainEntity("sales.task", { lead: { kind: "toOne", target: "sales.lead" } })],
        [
            "sales.note",
            plainEntity("sales.note", { lead: { kind: "toOne", target: "sales.lead", onDelete: "cascade" } }),
        ],
    ])

/** The runtime inputs of an insert: a fixed time, ids that count up, and sequence functions that show their inputs. */
export const insertStampOf = () => {
    let minted = 0
    return {
        now: "2026-11-05T10:00:00.000Z",
        newId: () => {
            minted += 1
            return `00000000-0000-4000-8000-${String(minted).padStart(12, "0")}`
        },
        date: { year: 2026, month: 11, day: 5 },
        sequences: {
            period: (resets: "day" | "month" | "year" | undefined, date: SequenceDate): string =>
                resets === undefined ? "" : String(date.year),
            format: (format: string, n: number): string => `${format}#${String(n)}`,
        },
    }
}
