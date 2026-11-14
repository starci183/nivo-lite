import type { EngineResult, RecordRow, WriteLinks, WriteValues } from "@nivo-lite/agent-sdk/entity/port"
import type { FieldDef, UniqueConstraint } from "@nivo-lite/agent-sdk/entity"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { ACCOUNTANT_CONTEXT, CATALOG, rowsOf, type MemoryWorld } from "./accounting.memory-world"
import { isNil, valueOf } from "./accounting.memory-rows"

/** The uuid-shaped id the fake mints for the n-th record of an entity. */
const idOf = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

/** The next id the fake mints: past every id of the world, so two entities never share one. */
const nextId = (world: MemoryWorld): string =>
    idOf(1_000_000 + [...world.tables.values()].reduce((count, rows) => count + rows.length, 0))

/** The unique constraints an entity declares. */
const uniquesOf = (entity: string): ReadonlyArray<UniqueConstraint> =>
    (CATALOG.get(entity)?.constraints ?? []).flatMap((declared) => (declared.kind === "unique" ? [declared] : []))

/** The unique constraint an insert or update of a record would break, if any: the same non-null values on another record. */
const clashOf = (entity: string, rows: ReadonlyArray<RecordRow>, row: RecordRow): EngineResult | null => {
    const constraint = uniquesOf(entity).find(
        (declared) =>
            declared.on.every((field) => !isNil(valueOf(row, field))) &&
            rows.some(
                (other) => other.id !== row.id && declared.on.every((f) => valueOf(other, f) === valueOf(row, f)),
            ),
    )
    return constraint === undefined
        ? null
        : { ok: false, reason: "taken", constraint: constraint.name, refusal: constraint.refusal }
}

/** The entry a field gets when an insert gives none: what its declared default writes; none for a field with no default. */
const defaultsOf = (name: string, def: FieldDef): ReadonlyArray<readonly [string, JsonValue]> => {
    if (def.default === "now") return [[name, ACCOUNTANT_CONTEXT.now.toISOString()]]
    if (def.default === "empty") return [[name, ""]]
    return typeof def.default === "object" ? [[name, def.default.literal]] : []
}

/** The values of an insert with the defaults of the entity laid under them. */
const withDefaults = (entity: string, values: WriteValues): WriteValues => {
    const fields = Object.entries(CATALOG.get(entity)?.fields ?? {})
    return { ...Object.fromEntries(fields.flatMap(([name, def]) => defaultsOf(name, def))), ...values }
}

/** Stores a record and the links it carries; refuses it when it would break a unique constraint. */
export const inserted = (
    world: MemoryWorld,
    entity: string,
    values: WriteValues,
    links: WriteLinks = {},
): EngineResult => {
    const row: RecordRow = {
        id: nextId(world),
        workspaceId: "w1",
        version: "1",
        createdAt: ACCOUNTANT_CONTEXT.now.toISOString(),
        updatedAt: ACCOUNTANT_CONTEXT.now.toISOString(),
        data: withDefaults(entity, values),
    }
    const clash = clashOf(entity, rowsOf(world, entity), row)
    if (clash !== null) return clash
    rowsOf(world, entity).push(row)
    for (const [relation, to] of Object.entries(links)) world.links.push({ entity, id: row.id, relation, to })
    return { ok: true, row, version: row.version, created: true }
}

/** Sets fields of a record whose version is the expected one; refuses a write that would break a unique constraint. */
export const updated = (
    world: MemoryWorld,
    entity: string,
    key: string,
    expected: string,
    values: WriteValues,
): EngineResult => {
    const rows = rowsOf(world, entity)
    const index = rows.findIndex((row) => row.id === key)
    const row = rows[index]
    if (row === undefined) return { ok: false, reason: "missing" }
    if (row.version !== expected) return { ok: false, reason: "stale" }
    const next: RecordRow = { ...row, version: String(Number(row.version) + 1), data: { ...row.data, ...values } }
    const clash = clashOf(entity, rows, next)
    if (clash !== null) return clash
    rows[index] = next
    return { ok: true, row: next, version: next.version }
}

/** Writes the values to the record the unique constraint `on` names (the one with the same values), or inserts them. */
export const upserted = (world: MemoryWorld, entity: string, on: string, values: WriteValues): EngineResult => {
    const constraint = uniquesOf(entity).find((declared) => declared.name === on)
    if (constraint === undefined) return { ok: false, reason: "invalid" }
    const existing = rowsOf(world, entity).find((row) =>
        constraint.on.every((field) => valueOf(row, field) === values[field]),
    )
    return existing === undefined
        ? inserted(world, entity, values)
        : updated(world, entity, existing.id, existing.version, values)
}

/** Finds the record a declared match key names (the one with the same values), or inserts the values. */
export const ensured = (world: MemoryWorld, entity: string, match: string, values: WriteValues): EngineResult => {
    const key = (CATALOG.get(entity)?.matchKeys ?? []).find((declared) => declared.name === match)
    if (key === undefined) return { ok: false, reason: "invalid" }
    const existing = rowsOf(world, entity).find((row) => key.on.every((field) => valueOf(row, field) === values[field]))
    return existing === undefined
        ? inserted(world, entity, values)
        : { ok: true, row: existing, version: existing.version, created: false }
}

/** Removes a record, when `expected` is given only while the version still matches, and the links it carries. */
export const deleted = (
    world: MemoryWorld,
    entity: string,
    key: string,
    expected: string | undefined,
): EngineResult => {
    const rows = rowsOf(world, entity)
    const index = rows.findIndex((row) => row.id === key)
    const row = rows[index]
    if (row === undefined) return { ok: false, reason: "missing" }
    if (expected !== undefined && row.version !== expected) return { ok: false, reason: "stale" }
    rows.splice(index, 1)
    world.links.splice(
        0,
        world.links.length,
        ...world.links.filter((link) => !(link.entity === entity && link.id === key)),
    )
    return { ok: true, row, version: row.version }
}

/** Links a record to another over a relation. */
export const linked = (world: MemoryWorld, entity: string, key: string, relation: string, to: string): EngineResult => {
    const row = rowsOf(world, entity).find((candidate) => candidate.id === key)
    if (row === undefined) return { ok: false, reason: "missing" }
    world.links.push({ entity, id: key, relation, to })
    return { ok: true, row, version: row.version }
}
