import { mock } from "@starci/jest-preset"
import type { EngineResult, ListPage, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { Mutation, MutationValues } from "@nivo-lite/agent-sdk/mutation"
import type { FilterExpr, Query } from "@nivo-lite/agent-sdk/query"
import {
    EntityEngineService,
    EntityMutationService,
    type ScopedTx,
    type ScopedWork,
} from "@modules/domain/entity-engine"
import type { Clock } from "@modules/platform/clock"
import { DomainError } from "@modules/platform/errors"
import { CORE_TABLE_KEYS, keyTaken } from "@tests/fixtures/builders/engine-core-tables.builder"

// The database of the phase-0 wave-C world (package 0-9), in memory: the records the thread engine reads and writes, and the engine's
// own core tables under their table names (`thread-world-tables.ts`: stops, freezes, holds; `engine-core-tables.builder.ts`: graphs,
// workflows, runs, steps, the effect ledger), with their unique keys, versions that move on every write, and a crash hook.

/** The workspace of every run. A uuid: the entity engine refuses any other scope. */
export const WS = "11111111-1111-4111-8111-111111111111"

/** What the world itself refuses: a script that ran dry, a record it cannot find, a filter it does not read, a crash it was told to make. */
export class WorldError extends DomainError<string> {}

/** The unique keys of the core tables the engine writes, as their migrations declare them. */
const UNIQUE: Readonly<Record<string, ReadonlyArray<ReadonlyArray<string>>>> = {
    ...CORE_TABLE_KEYS,
    run_stops: [["runId", "stepKey"]],
}

/** Which write the process dies at. */
export type CrashWhen = (mutation: Mutation) => boolean

/** One stored row and the entity it belongs to. */
export interface Held {
    /** The entity of the row. */
    readonly entity: string
    /** The row as it stands now. */
    row: RecordRow
}

/** Whether a row's data meets a filter of the shapes the engine's services ask (`eq`, `and`). */
const meets = (data: Readonly<Record<string, unknown>>, where: FilterExpr | undefined): boolean => {
    if (where === undefined) return true
    if (where.op === "and") return where.of.every((one) => meets(data, one))
    // The engine's services ask only `eq` and `and`; any other filter matches nothing here, so a spec that needs one fails visibly.
    return where.op === "eq" && JSON.stringify(data[where.field]) === JSON.stringify(where.value)
}

/** A value as the engine orders it: numbers padded so they sort as numbers. */
const sortTextOf = (row: RecordRow, field: string): string => {
    const value = field === "id" ? row.id : row.data[field]
    if (typeof value === "number") return String(value).padStart(12, "0")
    return typeof value === "string" ? value : JSON.stringify(value ?? "")
}

/** The records of every entity the thread engine writes, as one table each, behind the engine and mutation services. */
export class MemoryRecords {
    /** Every row, by id. */
    readonly rows: Map<string, Held> = new Map()

    /** Every write, in order. */
    readonly writes: Array<Mutation> = []

    /** The entity engine over these rows (scoped, within, get, list). */
    readonly engine: EntityEngineService

    /** The mutation service over these rows (insert, ensure, update). */
    readonly mutations: EntityMutationService

    private next = 0

    private crash: CrashWhen | null = null

    constructor(private readonly clock: Clock) {
        const tx = (workspaceId: string): ScopedTx => mock<ScopedTx>({ workspaceId })
        this.engine = mock<EntityEngineService>({
            scoped: <T>(workspaceId: string, work: ScopedWork<T>) => work(tx(workspaceId)),
            within: <T>(_manager: unknown, workspaceId: string, work: ScopedWork<T>) => work(tx(workspaceId)),
            get: (_tx: ScopedTx, entity: string, id: string) => Promise.resolve(this.get(entity, id)),
            list: (_tx: ScopedTx, query: Query) => Promise.resolve(this.list(query)),
        })
        this.mutations = mock<EntityMutationService>({
            mutate: (_tx: ScopedTx, mutation: Mutation) => Promise.resolve(this.mutate(mutation)),
        })
    }

    /** Writes one mutation at once, as the mutation service does (crash hook, unique keys, versions): the core tables' doubles. */
    write(mutation: Mutation): EngineResult {
        return this.mutate(mutation)
    }

    /** Removes one row of an entity or table. */
    remove(entity: string, id: string): void {
        if (this.rows.get(id)?.entity === entity) this.rows.delete(id)
    }

    /** The next write `when` matches throws instead of writing: the process died there. */
    crashOnce(when: CrashWhen): void {
        this.crash = when
    }

    /** Stores a row under its id, as a first version. */
    put(entity: string, id: string, data: RecordRow["data"]): RecordRow {
        const row = this.rowOf(id, "1", data, null)
        this.rows.set(id, { entity, row })
        return row
    }

    /** A copy of one row, or null. */
    get(entity: string, id: string): RecordRow | null {
        const held = this.rows.get(id)
        return held?.entity === entity ? structuredClone(held.row) : null
    }

    /** Copies of the rows of an entity whose data holds every value of `where`. */
    of(entity: string, where: Readonly<Record<string, unknown>> = {}): ReadonlyArray<RecordRow> {
        return [...this.rows.values()]
            .filter((held) => held.entity === entity)
            .map((held) => held.row)
            .filter((row) => Object.entries(where).every(([name, value]) => row.data[name] === value))
            .map((row) => structuredClone(row))
    }

    private list(query: Query): ListPage {
        const wanted = this.of(query.from).filter((row) => meets(row.data, query.where))
        const order = query.order ?? [["id", "asc"]]
        const sorted = wanted.toSorted((left, right) => {
            for (const [field, direction] of order) {
                const [a, b] = [sortTextOf(left, field), sortTextOf(right, field)]
                if (a !== b) return (a < b ? -1 : 1) * (direction === "desc" ? -1 : 1)
            }
            return 0
        })
        const size = query.page?.size ?? sorted.length
        return {
            rows: sorted.slice(0, size).map((row) => ({ row, joined: {}, position: [row.id], included: {} })),
            next: null,
        }
    }

    private mutate(mutation: Mutation): EngineResult {
        if (this.crash?.(mutation) === true) {
            this.crash = null
            throw new WorldError({ code: "WORLD_PROCESS_DIED", params: { entity: mutation.entity } })
        }
        this.writes.push(structuredClone(mutation))
        if (mutation.op === "insert") return this.insert(mutation.entity, mutation.values)
        if (mutation.op === "ensure") return this.ensure(mutation.entity, mutation.values)
        if (mutation.op !== "update") return { ok: false, reason: "invalid" }
        const held = this.rows.get(mutation.key)
        if (held?.entity !== mutation.entity) return { ok: false, reason: "missing" }
        if (mutation.expected !== held.row.version) return { ok: false, reason: "stale" }
        const version = String(Number(held.row.version) + 1)
        held.row = this.rowOf(held.row.id, version, { ...held.row.data, ...mutation.values }, held.row.createdAt)
        return { ok: true, row: structuredClone(held.row), version }
    }

    private ensure(entity: string, values: MutationValues): EngineResult {
        const found = this.taken(entity, values)
        if (found !== null) return { ok: true, row: structuredClone(found), version: found.version, created: false }
        return this.insert(entity, values)
    }

    private taken(entity: string, values: MutationValues): RecordRow | null {
        const keys = UNIQUE[entity] ?? []
        return this.of(entity).find((row) => keys.some((key) => keyTaken(row.data, values, key))) ?? null
    }

    private insert(entity: string, values: MutationValues): EngineResult {
        if (this.taken(entity, values) !== null)
            return { ok: false, reason: "taken", constraint: `${entity}:unique`, refusal: `${entity}-taken` }
        this.next += 1
        const row = this.put(entity, `${entity.split(".").at(-1) ?? entity}-${this.next}`, values)
        return { ok: true, row: structuredClone(row), version: "1", created: true }
    }

    private rowOf(id: string, version: string, data: RecordRow["data"], createdAt: string | null): RecordRow {
        const stamp = this.clock.now().toISOString()
        return {
            id,
            workspaceId: WS,
            version,
            createdAt: createdAt ?? stamp,
            updatedAt: stamp,
            data: structuredClone(data),
        }
    }
}
