import type { DataSlot } from "@nivo-lite/agent-sdk/client"

/**
 * What several reads that fill one list settle to: the rows of every read that has any, else the status that is left (loading
 * first, then a failure, then empty; forbidden only when no read may be seen at all).
 */
export const combinedSlots = <T>(slots: ReadonlyArray<DataSlot<ReadonlyArray<T>>>): DataSlot<ReadonlyArray<T>> => {
    const rows = slots.flatMap((slot) => ("items" in slot ? slot.items : []))
    if (rows.length > 0) return { items: rows }
    if (slots.some((slot) => "isLoading" in slot)) return { isLoading: true }
    if (slots.some((slot) => "isError" in slot)) return { isError: true }
    if (slots.some((slot) => "isEmpty" in slot || "items" in slot)) return { isEmpty: true }
    return { isForbidden: true }
}
