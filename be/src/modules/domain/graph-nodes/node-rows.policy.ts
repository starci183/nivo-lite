import type { NodeQuery } from "@nivo-lite/agent-sdk/node"
import type { NodeRow } from "./graph-nodes.contracts"

/** The most rows one read answers when the query names no limit. */
const DEFAULT_LIMIT = 50

/** Whether a row matches every entry of the query's `where`. */
const matches = (row: NodeRow, where: Readonly<Record<string, string | number | boolean>>): boolean =>
    Object.entries(where).every(([name, value]) => row[name] === value)

/** The row cut to the fields asked for. */
const cut = (row: NodeRow, fields: ReadonlyArray<string>): NodeRow =>
    Object.fromEntries(fields.map((field) => [field, row[field] ?? null]))

/**
 * What a data port answers from the rows it found: those that match the query's `where`, at most its limit, each cut to the fields
 * asked for, so a node never sees a field it did not name.
 */
export const rowsAnswering = (rows: ReadonlyArray<NodeRow>, query: NodeQuery): ReadonlyArray<NodeRow> =>
    rows
        .filter((row) => matches(row, query.where ?? {}))
        .slice(0, query.limit ?? DEFAULT_LIMIT)
        .map((row) => cut(row, query.fields))
