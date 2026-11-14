import type { ReadDefinition } from "../block/block.types"
import type { ListListing, ListShape, ListSource } from "../block/list.types"
import type { PortDefinition, PortMap, PortsOf, RunContext } from "../port/port.types"
import type { Namespaced, PropsSchema } from "../schema/schema.types"

/**
 * What a list read adds to the rows of each page from ports other than its source (a fact another store holds, for instance the
 * engine's last customer line of a chat's route): the page and its cursor stay the source's; only the rows are joined.
 */
export interface ListRowsJoin<T, P extends PortMap> {
    /** The ports the join reads, by the name `rows` reaches them by (never `source`: that is the list's own). */
    readonly ports: P
    /** The rows of one page, joined; the same rows in the same order (a join neither drops nor reorders). */
    readonly rows: (
        ports: PortsOf<ListJoinPorts<T, P>>,
        rows: ReadonlyArray<T>,
        context: RunContext,
    ) => Promise<ReadonlyArray<unknown>>
}

/** The ports a joined list read runs on: the join's own and the list's `source`. */
export type ListJoinPorts<T, P extends PortMap> = P & {
    /** The list's own source port: where the page's rows are read from before the join. */
    readonly source: PortDefinition<ListSource<T>>
}

/** What `listRead` takes. */
export interface ListReadConfig<T, P extends PortMap = PortMap> {
    /** The registry id of the read, `<module>.<name>`. */
    readonly id: Namespaced
    /** The kind of rows the list yields, which a slot may demand. */
    readonly dataKind: string
    /** The member permission a viewer needs. */
    readonly permission: string
    /** The fields of a row the list returns. */
    readonly fields: ReadonlyArray<string>
    /** What the list accepts: search, filters, sorts, page size and the row fields a list draws. */
    readonly list: ListShape
    /** The port the list runs on; its id is `<module>.<thing>-list`. */
    readonly source: PortDefinition<ListSource<T>>
    /** Variables beyond the derived ones (`q`, one per filter, `sort`, `cursor`), for instance a scoping id. */
    readonly variables?: PropsSchema
    /** What each page's rows get from other ports; absent: the source's rows as they are. */
    readonly join?: ListRowsJoin<T, P> | undefined
}

/** A list read: a read that also says what it lists, so a counts read and a spec can follow it. */
export interface ListReadDefinition extends ReadDefinition {
    /** What the read lists: its shape, default sort and source port. */
    readonly listing: ListListing
}

/** What `countsRead` takes. */
export interface CountsReadConfig {
    /** The registry id of the read, `<module>.<name>`. */
    readonly id: Namespaced
    /** The list read whose rows are counted. */
    readonly of: ListReadDefinition
    /** The filter of that list whose values are counted. */
    readonly by: string
    /** The member permission a viewer needs; the list's when absent. */
    readonly permission?: string
}
