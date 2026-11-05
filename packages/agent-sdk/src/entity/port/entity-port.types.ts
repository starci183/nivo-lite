import type { MutationResult, MutationValue } from "../../mutation/mutation.types"
import type { Aggregate, Query } from "../../query/query.types"

/** The record as the engine returns it: the system fields (times as ISO text, `version` as decimal text) and the declared fields in `data`. */
export interface RecordRow {
    /** The record id. */
    readonly id: string
    /** The owning workspace. */
    readonly workspaceId: string
    /** The version token. */
    readonly version: string
    /** Creation time, ISO text. */
    readonly createdAt: string
    /** Last write time, ISO text. */
    readonly updatedAt: string
    /** The declared fields. */
    readonly data: Readonly<Record<string, unknown>>
}

/** A position in an order: the text of each ordered expression of the last row of a page (null for SQL null). */
export type KeysetPosition = ReadonlyArray<string | null>

/** The result of a write on the engine: the record after it, or why it did not happen. */
export type EngineResult<R extends RecordRow = RecordRow> = MutationResult<R>

/** A record, or null when there is none in the workspace. */
export type OptionalRecordRow<R extends RecordRow = RecordRow> = R | null

/** One measure of a group: a number for count, sum and average, else the text of the min or max. */
export type MeasureValue = string | number | null

/** One group of an aggregate: the group values as text by field name and the measures by name. */
export interface AggregateRow {
    /** The text of each grouped expression (the bucket start for a bucket); null for SQL null. */
    readonly groups: Readonly<Record<string, string | null>>
    /** Counts, sums and averages are numbers; min and max are the text of the value. */
    readonly measures: Readonly<Record<string, MeasureValue>>
}

/** The record a toOne join found: its id and the selected fields. */
export interface JoinedRecord {
    /** The joined record id. */
    readonly id: string
    /** The selected fields. */
    readonly data: Readonly<Record<string, unknown>>
}

/** One row of a page with its joins and its position in the order. */
export interface ListedRecord<R extends RecordRow = RecordRow> {
    /** The record, its `data` limited to the query's select. */
    readonly row: R
    /** The toOne joins by relation name; null when the record has no link. */
    readonly joined: Readonly<Record<string, JoinedRecord | null>>
    /** The text of each ordered expression, to build the cursor of the next page. */
    readonly position: KeysetPosition
}

/** The declared fields a write carries, by field name. */
export interface WriteValues {
    /** The value of one declared field. */
    readonly [field: string]: MutationValue
}

/** The toOne links an insert makes: relation name to the id of the target record. */
export interface WriteLinks {
    /** The target of one relation. */
    readonly [relation: string]: string
}

/** A query over the entity of a port: the entity (`from`) is the port's. */
export interface EntityQuery extends Omit<Query, "from"> {
    /** The fields of each row. */
    readonly select: ReadonlyArray<string>
}

/** An aggregate over the entity of a port: the entity (`from`) is the port's. */
export interface EntityAggregate extends Omit<Aggregate, "from"> {
    /** At most this many groups. */
    readonly limit: number
}

/** A record of a page: its fields, its toOne joins and the toMany records included for it. */
export interface PageRow<R extends RecordRow = RecordRow> extends ListedRecord<R> {
    /** The toMany records by relation name, at most `latest` each, in the include's order. */
    readonly included: Readonly<Record<string, ReadonlyArray<RecordRow>>>
}

/** One page of a list read. */
export interface ListPage<R extends RecordRow = RecordRow> {
    /** The rows, at most the page size. */
    readonly rows: ReadonlyArray<PageRow<R>>
    /** The signed cursor of the next page; null on the last page. */
    readonly next: string | null
}

/** The data port of blocks-core code over every entity, bound to one scope. */
export interface EntitiesApi {
    /** One record by id; null when there is none in the workspace. */
    get(entity: string, id: string): Promise<OptionalRecordRow>
    /** One page of a query. */
    list(query: Query): Promise<ListPage>
    /** The groups and measures of an aggregate. */
    aggregate(aggregate: Aggregate): Promise<ReadonlyArray<AggregateRow>>
    /** Inserts one record, linking its toOne relations. */
    insert(entity: string, values: WriteValues, links?: WriteLinks): Promise<EngineResult>
    /** Updates a record whose version is still `expected`. */
    update(entity: string, key: string, expected: string, values: WriteValues): Promise<EngineResult>
    /** Inserts, or updates the record a declared unique constraint names. */
    upsert(entity: string, on: string, values: WriteValues): Promise<EngineResult>
    /** Finds the record a declared match key names, or inserts it. */
    ensure(entity: string, match: string, values: WriteValues): Promise<EngineResult>
    /** Deletes a record of a deletable entity. */
    delete(entity: string, key: string, expected?: string): Promise<EngineResult>
    /** Links a record to another over a declared relation. */
    link(entity: string, key: string, relation: string, to: string): Promise<EngineResult>
    /** Removes the link of a record to another. */
    unlink(entity: string, key: string, relation: string, to: string): Promise<EngineResult>
}

/** The data port of one entity: `EntitiesApi` with the entity name applied; `R` is the row its records are read as. */
export interface EntityApi<R extends RecordRow = RecordRow> {
    /** One record by id. */
    get(id: string): Promise<OptionalRecordRow<R>>
    /** One page of a query over the entity. */
    list(query: EntityQuery): Promise<ListPage<R>>
    /** The groups and measures of an aggregate over the entity. */
    aggregate(aggregate: EntityAggregate): Promise<ReadonlyArray<AggregateRow>>
    /** Inserts one record. */
    insert(values: WriteValues, links?: WriteLinks): Promise<EngineResult<R>>
    /** Updates a record whose version is still `expected`. */
    update(key: string, expected: string, values: WriteValues): Promise<EngineResult<R>>
    /** Inserts, or updates the record a declared unique constraint names. */
    upsert(on: string, values: WriteValues): Promise<EngineResult<R>>
    /** Finds the record a declared match key names, or inserts it. */
    ensure(match: string, values: WriteValues): Promise<EngineResult<R>>
    /** Deletes a record. */
    delete(key: string, expected?: string): Promise<EngineResult<R>>
    /** Links a record to another. */
    link(key: string, relation: string, to: string): Promise<EngineResult<R>>
    /** Removes a link. */
    unlink(key: string, relation: string, to: string): Promise<EngineResult<R>>
}
