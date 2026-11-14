import type { z } from "zod"
import type { AnyEntityDefinition } from "../entity/entity-any.types"
import { entityPort } from "../entity/port/entity-port"
import type { AggregateRow, EntityAggregate, EntityApi, EntityQuery, RecordRow } from "../entity/port/entity-port.types"
import { agentOfRecordType } from "../entity/record-scope"
import type { PortDefinition } from "../port/port.types"
import { isQualifiedRead, moduleKeyOfOperation } from "../schema/namespaced"
import type { PropsSchema } from "../schema/schema.types"
import { defineRead } from "./block"
import type { ReadDefinition, RunReadConfig } from "./block.types"
import { SdkDefinitionError } from "./definition-error"

/** What a record query reads, declared as data built from the variables: one page, one record by id, or the groups of an aggregate. */
type RecordQueryBody<V extends PropsSchema> =
    /** One page of the type: the rows (through `view` when declared) and the cursor of the next page. */
    | { readonly list: (variables: z.infer<V>) => EntityQuery }
    /** One record by id, through `view` when declared; null when there is none. */
    | { readonly get: (variables: z.infer<V>) => string }
    /** The groups and measures of an aggregate over the type. */
    | { readonly aggregate: (variables: z.infer<V>) => EntityAggregate }

/**
 * What `defineRecordQuery` takes: a read (`<package>.<agent>.api.<domain>.<query>`) over ONE record type of the read's own agent, the
 * query declared as data (`EntityQuery`, the filter / order / page / include tree of the query builder `q`), never code over ports.
 */
export type RecordQueryConfig<V extends PropsSchema> = Omit<RunReadConfig<V, never, unknown>, "ports" | "run"> & {
    /** The record type the query reads: a type of the agent the id names. */
    readonly type: AnyEntityDefinition
    /** The shape a row is answered in; absent: the row as the engine reads it. */
    readonly view?: (row: RecordRow) => unknown
} & RecordQueryBody<V>

/** The ports of a record query: only its own type's. */
type RecordPorts = { readonly records: PortDefinition<EntityApi> }

/** The rows of a list page and the cursor of the next one. */
interface RecordPage {
    readonly rows: ReadonlyArray<unknown>
    readonly cursor: string | null
}

/**
 * Defines a record query (the records frame's `defineRecordQuery`): a declarative read over one record type of the read's own agent,
 * served by the same door as every read (it IS a `defineRead` whose only port is the type's and whose run is the declared query). The
 * engine adds the workspace and, for an agent's call, the agent filter: the declaration never names either. Throws
 * `SdkDefinitionError` `ID_MALFORMED` for an id that is not `<package>.<agent>.api.<domain>.<query>` and `RECORD_QUERY_OTHER_AGENT`
 * for a type of another agent than the one the id names (agents never read each other's records).
 */
export const defineRecordQuery = <V extends PropsSchema>(config: RecordQueryConfig<V>): ReadDefinition<V> => {
    if (!isQualifiedRead(config.id)) throw new SdkDefinitionError("ID_MALFORMED", config.id)
    if (moduleKeyOfOperation(config.id) !== agentOfRecordType(config.type.name)) {
        throw new SdkDefinitionError("RECORD_QUERY_OTHER_AGENT", `${config.id}:${config.type.name}`)
    }
    const { view } = config
    const shown = (row: RecordRow): unknown => (view === undefined ? row : view(row))
    const ports: RecordPorts = { records: entityPort(config.type) }
    const read = async (records: EntityApi, variables: z.infer<V>): Promise<unknown> => {
        if ("list" in config) {
            const page = await records.list(config.list(variables))
            const answered: RecordPage = { rows: page.rows.map((listed) => shown(listed.row)), cursor: page.next }
            return answered
        }
        if ("get" in config) {
            const found = await records.get(config.get(variables))
            return found === null ? null : shown(found)
        }
        const groups: ReadonlyArray<AggregateRow> = await records.aggregate(config.aggregate(variables))
        return groups
    }
    return defineRead<V, RecordPorts, unknown>({
        id: config.id,
        dataKind: config.dataKind,
        shape: config.shape,
        fields: config.fields,
        paths: config.paths,
        variables: config.variables,
        permission: config.permission,
        ports,
        run: ({ records }, variables) => read(records, variables),
    })
}
