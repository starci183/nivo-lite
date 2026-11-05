import type { MutationResult, MutationValue } from "@nivo-lite/agent-sdk/mutation"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import type { Aggregate, Query } from "@nivo-lite/agent-sdk/query"
import type { AggregateRow } from "./policies/aggregate-records.policy"
import type { RecordRow } from "./policies/compiler.contracts"
import type { ListedRecord } from "./policies/list-records.policy"
import type { ScopedTx } from "./policies/scoped-tx.contracts"

/** The port id of the multi-entity data port: every entity of the catalog through one handle. */
export const ENTITIES_PORT_ID = "engine.entities"

/** The prefix of the id of a data port bound to one entity: `engine.entity.<entity name>`. */
export const ENTITY_PORT_PREFIX = "engine.entity."

/** The result of a write on the engine: the record after it, or why it did not happen. */
export type EngineResult = MutationResult<RecordRow>

/** A record, or null when there is none in the workspace. */
export type OptionalRecordRow = RecordRow | null

/** Work that runs in a scoped transaction. */
export type ScopedWork<T> = (tx: ScopedTx) => Promise<T>

/** Runs `use` in the scope a port is bound to: the one transaction of the caller, or a transaction of its own per call. */
export type RunIn = <T>(use: ScopedWork<T>) => Promise<T>

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

/** The ports a job or action asks for, by the name it calls them. */
export interface DeclaredPorts {
    /** The declaration of one port. */
    readonly [name: string]: PortDefinition<unknown>
}

/** The handles a job or action receives, by the name it called its ports. */
export interface JobPorts {
    /** The handle of one port. */
    readonly [name: string]: unknown
}

/** A record of a page: its fields, its toOne joins and the toMany records included for it. */
export interface PageRow extends ListedRecord {
    /** The toMany records by relation name, at most `latest` each, in the include's order. */
    readonly included: Readonly<Record<string, ReadonlyArray<RecordRow>>>
}

/** One page of a list read. */
export interface ListPage {
    /** The rows, at most the page size. */
    readonly rows: ReadonlyArray<PageRow>
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

/** The data port of one entity: `EntitiesApi` with the entity name applied. */
export interface EntityApi {
    /** One record by id. */
    get(id: string): Promise<OptionalRecordRow>
    /** One page of a query over the entity. */
    list(query: EntityQuery): Promise<ListPage>
    /** The groups and measures of an aggregate over the entity. */
    aggregate(aggregate: EntityAggregate): Promise<ReadonlyArray<AggregateRow>>
    /** Inserts one record. */
    insert(values: WriteValues, links?: WriteLinks): Promise<EngineResult>
    /** Updates a record whose version is still `expected`. */
    update(key: string, expected: string, values: WriteValues): Promise<EngineResult>
    /** Inserts, or updates the record a declared unique constraint names. */
    upsert(on: string, values: WriteValues): Promise<EngineResult>
    /** Finds the record a declared match key names, or inserts it. */
    ensure(match: string, values: WriteValues): Promise<EngineResult>
    /** Deletes a record. */
    delete(key: string, expected?: string): Promise<EngineResult>
    /** Links a record to another. */
    link(key: string, relation: string, to: string): Promise<EngineResult>
    /** Removes a link. */
    unlink(key: string, relation: string, to: string): Promise<EngineResult>
}
