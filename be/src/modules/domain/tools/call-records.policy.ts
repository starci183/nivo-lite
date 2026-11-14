import type { ToolJson } from "@modules/domain/tool-receipts"
import { isRecord } from "@modules/platform/primitives"
import type { ToolScope } from "./tool-manifest.contracts"

/** The records one `ok` call touched, as its adapter stated them; null where it stated none. */
export interface StatedRecords {
    /** The records a read answered, or null. */
    readonly read: number | null
    /** The records a write changed, or null. */
    readonly changed: number | null
}

/** A call whose adapter stated no count. */
export const NO_RECORDS: StatedRecords = { read: null, changed: null }

/** The member a page lists its entries under in the provider envelope. */
const ITEMS = "items"

/** The lowest and the first status past the success range of the provider envelope. */
const SUCCESS = { from: 200, to: 300 } as const

/**
 * The provider envelope `{ ok, status, data, truncated, omitted }`: the structured answer the provider adapters give (the OpenAPI tools),
 * whose `data` is the answered record or page and whose `omitted` counts the page entries cut from the answer. Null for any other answer.
 */
const envelopeOf = (value: ToolJson): { readonly data: unknown; readonly omitted: number } | null => {
    const { ok, status, omitted } = value
    if (ok !== true || typeof status !== "number" || typeof omitted !== "number" || !("data" in value)) return null
    if (status < SUCCESS.from || status >= SUCCESS.to) return null
    return { data: value["data"], omitted }
}

/** The records a read's data holds: a page counts its entries and the ones the answer omitted, one record counts 1, nothing is unstated. */
const readCountOf = (data: unknown, omitted: number): number | null => {
    if (Array.isArray(data)) return data.length + omitted
    if (!isRecord(data)) return null
    const items = data[ITEMS]
    return Array.isArray(items) ? items.length + omitted : 1
}

/**
 * The records an `ok` call touched, as its adapter STATED them in its structured answer, never guessed from text: an answer in the
 * provider envelope states them (a read: the entries of its page plus the omitted ones, or 1 for one record; a write: 1, one operation
 * acting on one record); any other answer states none.
 */
export const statedRecordsOf = (scope: ToolScope, value: ToolJson): StatedRecords => {
    const envelope = envelopeOf(value)
    if (envelope === null) return NO_RECORDS
    if (scope === "read") return { read: readCountOf(envelope.data, envelope.omitted), changed: null }
    return { read: null, changed: 1 }
}
