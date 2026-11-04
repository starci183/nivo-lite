import type { DataSlot } from "../../slot/slot.types"
import { valueAt } from "../../spec/spec-value"
import type { HostRead } from "../../host/host.types"

/** A read folded into a slot, and whether a bound path was missing in ready data (a contract defect). */
export interface FoldedRead {
    /** The slot the block draws for this read. */
    readonly slot: DataSlot<unknown>
    /** True when the read is ready but a path the spec bound is missing in its data, a contract defect to report. */
    readonly isDefect: boolean
}

/** Whether a settled value draws as empty. */
const isEmptyValue = (value: unknown): boolean => value === null || (Array.isArray(value) && value.length === 0)

/**
 * Folds the state of a host read and the path a spec narrowed it to into one slot. A path missing in ready data is an error slot
 * and a defect, never a blank block.
 */
export const foldRead = (read: HostRead, path: string | undefined): FoldedRead => {
    if (read.status === "loading") return { slot: { isLoading: true }, isDefect: false }
    if (read.status === "forbidden") return { slot: { isForbidden: true }, isDefect: false }
    if (read.status === "error") return { slot: { isError: true }, isDefect: false }
    const value = valueAt(read.data, path)
    if (value === undefined) return { slot: { isError: true }, isDefect: true }
    const validation = { isValidating: read.isValidating }
    return {
        slot: isEmptyValue(value) ? { isEmpty: true, ...validation } : { items: value, ...validation },
        isDefect: false,
    }
}
