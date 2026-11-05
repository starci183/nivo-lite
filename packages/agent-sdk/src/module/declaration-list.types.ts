import type { ReadDefinition } from "../block/block.types"
import type { ListListing, ListShape, ListSource } from "../block/list.types"
import type { PortDefinition } from "../port/port.types"
import type { Namespaced, PropsSchema } from "../schema/schema.types"

/** What `listRead` takes. */
export interface ListReadConfig<T> {
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
