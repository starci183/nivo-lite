import type { ListShape, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { countsRead, listRead, type ListReadDefinition } from "@nivo-lite/agent-sdk/module"
import { ENTRY_STATUSES } from "../rules/entry-status"
import type { EntryRow } from "../accounting.types"
import { ENTRIES_LIST } from "../ports"

/** The kinds of book entry a filter takes. */
export const ENTRY_KINDS: readonly ["income", "expense", "invoice", "reversal", "adjustment"] = [
    "income",
    "expense",
    "invoice",
    "reversal",
    "adjustment",
]

/**
 * What the entries list accepts: search over the note, a filter by kind, newest-first or largest-first, and 30 entries a page. The
 * provider turns the shape and a query into one query; nothing here is a clause.
 */
export const ENTRIES_SHAPE: ListShape = {
    search: { fields: ["note"] },
    filters: {
        kind: { field: "kind", op: "eq", of: ENTRY_KINDS },
        status: { field: "status", op: "eq", of: ENTRY_STATUSES },
    },
    sort: {
        recent: [
            ["entryDate", "desc"],
            ["id", "desc"],
        ],
        amount: [
            ["amountVnd", "desc"],
            ["id", "desc"],
        ],
    },
    page: { size: 30 },
    row: { id: "id", title: "note", description: "entryDate", badge: "kind" },
}

/** `blocks-core.sales.api.entry.list`: the entries of the books, searched, filtered by kind and paged. */
export const entriesRead: ListReadDefinition = listRead<EntryRow>({
    id: "blocks-core.sales.api.entry.list",
    dataKind: "book-entry",
    permission: "sales.view",
    fields: ["id", "note", "entryDate", "kind", "amountVnd", "status", "counterparty"],
    list: ENTRIES_SHAPE,
    source: ENTRIES_LIST,
})

/** `blocks-core.sales.api.entry.counts`: how many entries each kind holds under the same search. */
export const entryCountsRead: ReadDefinition = countsRead({
    id: "blocks-core.sales.api.entry.counts",
    of: entriesRead,
    by: "kind",
})

/** `blocks-core.sales.api.entry.status-counts`: how many entries each status holds under the same search. */
export const entryStatusCountsRead: ReadDefinition = countsRead({
    id: "blocks-core.sales.api.entry.status-counts",
    of: entriesRead,
    by: "status",
})
