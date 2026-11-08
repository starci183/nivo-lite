import { Injectable } from "@nestjs/common"
import { fieldNumberOf } from "@modules/platform/primitives"
import { cursorScopeOf, countsOf, listQueryOf, type ListQuery, type ListShape } from "@nivo-lite/agent-sdk/query"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { EntityEngineService } from "./entity-engine.service"
import type { ScopedTx } from "./policies/scoped-tx.contracts"

/** One page of a named list read. */
export interface ListSourceRequest {
    /** The name of the read; the cursor is bound to it. */
    readonly read: string
    /** The entity the list shows. */
    readonly entity: string
    /** The shape the read declares (search, filters, sorts, page, row fields). */
    readonly shape: ListShape
    /** The parsed variables of the read. */
    readonly query: ListQuery
    /** Further fields to select beyond the shape's row fields. */
    readonly select?: ReadonlyArray<string>
}

/** The rows of a page and the signed cursor of the next one. */
export interface ListSourcePage {
    /** The records, their `data` limited to the selected fields. */
    readonly rows: ReadonlyArray<RecordRow>
    /** The cursor of the next page; null on the last page. */
    readonly next: string | null
}

/** The counts of one filter of a list. */
export interface ListSourceCounts {
    /** The entity the list shows. */
    readonly entity: string
    /** The shape the read declares. */
    readonly shape: ListShape
    /** The name of the filter whose values are counted. */
    readonly by: string
    /** The parsed variables of the list (its own choice of `by` is ignored). */
    readonly query: ListQuery
}

/** The count of each value of a filter, by value (or by case name). */
export interface ListCounts {
    /** The number of records of one value. */
    readonly [value: string]: number
}

@Injectable()
/**
 * The generic `ListSource`: a list read's shape and variables become one query tree (`listQueryOf`, the same one the fe fixture port
 * builds) that the engine runs, with a signed cursor bound to the read, its search, its filters and its sort; the tab counts are one
 * aggregate (`countsOf`) with the same search and filters minus the counted one.
 */
export class ListSourceService {
    constructor(private readonly engine: EntityEngineService) {}

    /** One page of the list. */
    async page(tx: ScopedTx, request: ListSourceRequest): Promise<ListSourcePage> {
        const { read, entity, shape, query } = request
        const tree = listQueryOf(
            this.engine.definition(entity),
            shape,
            query,
            request.select === undefined ? {} : { select: request.select },
        )
        const scope = cursorScopeOf(read, { ...query.filters, $q: query.q ?? "" }, query.sort)
        const page = await this.engine.list(tx, tree, scope)
        return { rows: page.rows.map((listed) => listed.row), next: page.next }
    }

    /** The count of each value of the filter `by` (an `of` filter), or of each named case (a `cases` filter); a value with no record is absent. */
    async counts(tx: ScopedTx, request: ListSourceCounts): Promise<ListCounts> {
        const { entity, shape, by, query } = request
        const tree = countsOf(this.engine.definition(entity), shape, by, query)
        const rows = await this.engine.aggregate(tx, tree)
        return Object.fromEntries(
            rows.flatMap((row): Array<readonly [string, number]> =>
                tree.groupBy === undefined
                    ? Object.entries(row.measures).map(([name, value]) => [name, fieldNumberOf(value) ?? 0])
                    : [[Object.values(row.groups)[0] ?? "", fieldNumberOf(row.measures.count) ?? 0]],
            ),
        )
    }
}
