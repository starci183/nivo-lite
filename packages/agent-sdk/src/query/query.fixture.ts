import { z } from "zod"
import type { EntityDefinition } from "../entity/entity.types"
import type { ListShape } from "./list-shape.mirror.types"

const shape = z.record(z.string().max(40), z.string().max(200)).refine((entries) => Object.keys(entries).length <= 20)

/** A lead-like entity with every kind of field, relation and index a query tree meets. */
export const LEAD: EntityDefinition = {
    entry: "entity",
    name: "sales.lead",
    dataKind: "sales-lead",
    fields: {
        ownerId: { kind: "uuid", nullable: true },
        contactName: { kind: "text", nullable: false, maxLength: 200, searchable: true },
        stage: { kind: "enum", nullable: false, of: ["new", "qualified", "won", "lost"] },
        channel: { kind: "text", nullable: true, maxLength: 40 },
        amountVnd: { kind: "money_vnd", nullable: true },
        total: { kind: "bigint", nullable: false },
        active: { kind: "bool", nullable: false },
        startsAt: { kind: "timestamptz", nullable: true },
        endsAt: { kind: "timestamptz", nullable: true },
        day: { kind: "date", nullable: true },
        data: {
            kind: "jsonb",
            nullable: false,
            shape,
            keys: {
                tier: { kind: "text", filter: true, sort: true },
                score: { kind: "int", filter: true },
                rank: { kind: "int", sort: true },
                note: { kind: "text" },
            },
        },
    },
    relations: {
        owner: { kind: "toOne", target: "sales.owner" },
        messages: { kind: "toMany", target: "sales.message" },
        ghosts: { kind: "toMany", target: "sales.ghost" },
    },
    indexes: [
        { name: "leads_recent", on: [{ desc: "updatedAt" }, { desc: "id" }] },
        { name: "leads_stage_recent", on: ["stage", { desc: "updatedAt" }, { desc: "id" }] },
        { name: "leads_created", on: ["createdAt", "id"] },
        { name: "leads_folded", on: [{ fold: "contactName" }] },
        { name: "leads_tier", on: [{ key: ["data", "tier"] }, "id"] },
        { name: "leads_partial", on: ["channel", "id"], where: { op: "notNull", field: "channel" } },
        { name: "leads_gin", on: ["data"], using: "gin" },
        { name: "leads_empty", on: [] },
    ],
}

export const OWNER: EntityDefinition = {
    entry: "entity",
    name: "sales.owner",
    dataKind: "sales-owner",
    fields: {
        name: { kind: "text", nullable: false, maxLength: 100 },
    },
}

export const MESSAGE: EntityDefinition = {
    entry: "entity",
    name: "sales.message",
    dataKind: "sales-message",
    fields: {
        leadId: { kind: "uuid", nullable: false },
        body: { kind: "text", nullable: false, maxLength: 2000 },
    },
}

/** The catalog of the fixture; `sales.ghost` is a relation target the catalog does not hold. */
export const CATALOG: ReadonlyMap<string, EntityDefinition> = new Map(
    [LEAD, OWNER, MESSAGE].map((entity) => [entity.name, entity]),
)

/** A list shape over the lead: a search, an `of` filter, a `cases` filter, two sorts. */
export const LEAD_SHAPE: ListShape = {
    search: { fields: ["contactName"] },
    filters: {
        stage: { field: "stage", op: "eq", of: ["new", "qualified", "won", "lost"] },
        stages: { field: "stage", op: "in", of: ["new", "won"] },
        active: { field: "active", op: "eq", of: ["true", "false", "maybe"] },
        big: { field: "amountVnd", op: "eq", of: ["1000", "2000", "oops"] },
        handled: {
            cases: {
                open: { field: "ownerId", op: "eq", value: null },
                big: { field: "amountVnd", op: "gte", value: 1000 },
                late: { field: "endsAt", op: "lt", ref: "startsAt" },
                one: { field: "stage", op: "in", value: "new" },
            },
        },
    },
    sort: {
        recent: [
            ["updatedAt", "desc"],
            ["id", "desc"],
        ],
        name: [["contactName", "asc"]],
        bare: [],
    },
    page: { size: 20 },
    row: { id: "id", title: "contactName", description: "channel", badge: "stage" },
}

/** A list shape without search and without filters. */
export const PLAIN_SHAPE: ListShape = {
    sort: LEAD_SHAPE.sort,
    page: { size: 20 },
    row: { id: "id", title: "contactName" },
}
