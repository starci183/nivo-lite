import { FindOperator } from "typeorm"
import type { FactRecord } from "@modules/domain/brain-facts"
import fx from "@modules/domain/dossier-review/document-critic.acceptance.fixtures.json"
import { DossierFindingEntity, SourceCritiqueEntity } from "@modules/domain/dossier-review/persistence/entities"
import { chunkPassages } from "@modules/domain/knowledge-chunks"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

/**
 * The in-memory world of the shop-document critic acceptance (lanes/brain-test-20261111: `tiem-hoa-quy-dinh.md` v1 and v2): the
 * tables, the passages as the index job cuts them and the entity manager the critic runs on.
 */

/** The error of a misused world or a row it does not hold: the test world's own family. */
export const worldError = (what: string): TestWorldError => new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what } })

/** True when a value is a list of strings. */
const isStringList = (value: unknown): value is ReadonlyArray<string> => Array.isArray(value) && value.every((one) => typeof one === "string")
export const WS = "11111111-1111-4111-8111-111111111111"
export const SRC = "22222222-2222-4222-8222-222222222222"
export const OWNER = "33333333-3333-4333-8333-333333333333"
export const NOW: Date = new Date("2026-11-11T10:00:00.000Z")
export const W: typeof fx.words = fx.words

export const V1: string = fx.v1
export const V2: string = V1.replace(fx.oldRush, fx.newRush)
export const V3: string = V2.replace(fx.oldCash, fx.newCash)

// ---------------------------------------------------------------- the in-memory world

/** A row of the in-memory tables. */
export type Row = Record<string, unknown>
/** One stored passage of the document. */
export interface Chunk {
    id: string
    content: string
    customerReady: boolean
    /** What triage made of the passage (`rule`, `data`, `none`); absent while not judged. */
    triage?: "rule" | "data" | "none"
}
const matches = (value: unknown, wanted: unknown): boolean => {
    if (!(wanted instanceof FindOperator)) return value === wanted
    const inner: unknown = wanted.value
    switch (wanted.type) {
        case "in":
            return Array.isArray(inner) && inner.includes(value)
        case "isNull":
            return value === null || value === undefined
        case "like":
            return typeof value === "string" && typeof inner === "string" && value.startsWith(inner.replace(/%$/u, ""))
        case "arrayContains":
            return Array.isArray(value) && Array.isArray(inner) && inner.every((one) => value.includes(one))
        case "arrayOverlap":
            return Array.isArray(value) && Array.isArray(inner) && inner.some((one) => value.includes(one))
        case "lessThan":
            return value instanceof Date && inner instanceof Date && value.getTime() < inner.getTime()
        case "moreThanOrEqual":
            return value instanceof Date && inner instanceof Date && value.getTime() >= inner.getTime()
        case "not":
            return !matches(value, inner)
        case "and":
        case "any":
        case "arrayContainedBy":
        case "between":
        case "equal":
        case "ilike":
        case "jsonContains":
        case "lessThanOrEqual":
        case "moreThan":
        case "or":
        case "raw":
            throw worldError(`operator ${wanted.type}`)
    }
}

/** The options of a find of the in-memory manager. */
interface FindOptions {
    where: Row
    take?: number
}

/** What the query builder chain has been told so far. */
interface BuilderState {
    entity?: unknown
    values?: Row
    where?: string
    params?: Row
    set?: Row
}

/** The query builder chain the critic uses. */
interface Builder {
    insert: () => Builder
    into: (entity: unknown) => Builder
    values: (values: Row) => Builder
    orIgnore: () => Builder
    update: (entity: unknown) => Builder
    set: (set: Row) => Builder
    where: (where: string, params: Row) => Builder
    execute: () => Promise<unknown>
}

/** The in-memory world: the tables, the passages and the entity manager the critic runs on. */
export class World {
    readonly critiques: Array<Row> = []
    readonly findings: Array<Row> = []
    chunks: Array<Chunk> = []
    facts: Array<FactRecord> = []
    /** The level of the document, copied on every passage as the store does. */
    visibility = "public"
    private seq = 0

    nextId(prefix: string): string {
        this.seq += 1
        return `${prefix}-${String(this.seq).padStart(4, "0")}`
    }

    tableOf(entity: unknown): Array<Row> {
        if (entity === SourceCritiqueEntity) return this.critiques
        if (entity === DossierFindingEntity) return this.findings
        throw worldError("unknown entity")
    }

    rowsWhere(entity: unknown, where: Row): Array<Row> {
        return this.tableOf(entity).filter((row) =>
            Object.entries(where).every(([key, wanted]) => matches(row[key], wanted)),
        )
    }

    /** The index job: the passages of a text, an unchanged passage keeping its row (and its gate), a new one withheld. */
    upload(text: string): void {
        const old = this.chunks
        this.chunks = chunkPassages(text).map(
            (content) =>
                old.find((chunk) => chunk.content === content) ?? {
                    id: this.nextId("c"),
                    content,
                    customerReady: false,
                },
        )
    }

    chunkWith(words: string): Chunk {
        const found = this.chunks.find((chunk) => chunk.content.includes(words))
        if (found === undefined) throw worldError(`no passage with ${words}`)
        return found
    }

    readonly em: Readonly<Record<string, jest.Mock>> = {
        update: jest.fn((entity: unknown, where: Row, set: Row) => {
            const rows = this.rowsWhere(entity, where)
            for (const row of rows) Object.assign(row, set, { updatedAt: NOW })
            return Promise.resolve({ affected: rows.length })
        }),
        find: jest.fn((entity: unknown, options: FindOptions) =>
            Promise.resolve(this.rowsWhere(entity, options.where).slice(0, options.take ?? 10_000)),
        ),
        findOne: jest.fn((entity: unknown, options: Pick<FindOptions, "where">) =>
            Promise.resolve(this.rowsWhere(entity, options.where)[0] ?? null),
        ),
        findOneOrFail: jest.fn((entity: unknown, options: Pick<FindOptions, "where">) => {
            const [row] = this.rowsWhere(entity, options.where)
            return row === undefined ? Promise.reject(worldError("not found")) : Promise.resolve(row)
        }),
        exists: jest.fn((entity: unknown, options: Pick<FindOptions, "where">) =>
            Promise.resolve(this.rowsWhere(entity, options.where).length > 0),
        ),
        insert: jest.fn((entity: unknown, rows: ReadonlyArray<Row>) => {
            for (const row of rows) {
                this.tableOf(entity).push({
                    id: this.nextId("f"),
                    status: "open",
                    resolution: null,
                    resolvedAt: null,
                    reopenedCount: 0,
                    decidedAt: null,
                    decidedBy: null,
                    decisionNote: null,
                    dismissReason: null,
                    createdAt: NOW,
                    updatedAt: NOW,
                    ...row,
                })
            }
            return Promise.resolve({})
        }),
        transaction: jest.fn(<T>(work: (tx: unknown) => Promise<T>) => work(this.em)),
        query: jest.fn((sql: string, params: ReadonlyArray<unknown>) => {
            if (sql.startsWith("UPDATE public.knowledge_chunks")) {
                const ready = params[2]
                if (!isStringList(ready)) throw worldError("sql params")
                for (const chunk of this.chunks) chunk.customerReady = ready.includes(chunk.id)
                return Promise.resolve([])
            }
            if (sql.startsWith("SELECT count(*)")) {
                return Promise.resolve([
                    { total: this.chunks.length, ready: this.chunks.filter((chunk) => chunk.customerReady).length },
                ])
            }
            throw worldError(`sql ${sql}`)
        }),
        createQueryBuilder: jest.fn(() => {
            const state: BuilderState = {}
            const builder: Builder = {
                insert: () => builder,
                into: (entity: unknown) => {
                    state.entity = entity
                    return builder
                },
                values: (values: Row) => {
                    state.values = values
                    return builder
                },
                orIgnore: () => builder,
                update: (entity: unknown) => {
                    state.entity = entity
                    return builder
                },
                set: (set: Row) => {
                    state.set = set
                    return builder
                },
                where: (where: string, params: Row) => {
                    state.where = where
                    state.params = params
                    return builder
                },
                execute: () => {
                    if (state.values !== undefined) {
                        const table = this.tableOf(state.entity)
                        if (!table.some((row) => row.sourceId === state.values?.sourceId)) {
                            table.push({
                                id: this.nextId("q"),
                                reviewedHashes: [],
                                verifiedTruths: [],
                                modelCalls: 0,
                                promptTokens: 0,
                                startedAt: null,
                                finishedAt: null,
                                ...state.values,
                            })
                        }
                        return Promise.resolve({})
                    }
                    if (state.where?.includes("requestedAt > startedAt") === true) {
                        for (const row of this.rowsWhere(state.entity, {
                            workspaceId: state.params?.workspaceId,
                            sourceId: state.params?.sourceId,
                        })) {
                            const { requestedAt: requested, startedAt: started } = row
                            if (requested instanceof Date && started instanceof Date && requested.getTime() > started.getTime())
                                Object.assign(row, state.set)
                        }
                        return Promise.resolve({})
                    }
                    throw worldError(`builder ${state.where ?? ""}`)
                },
            }
            return builder
        }),
    }
}
