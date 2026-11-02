import type { DataSlot, WorkbenchRowView, SlotRead } from "@/modules/types"
import { isForbiddenFailure } from "@/modules/failure"

/** A slot whose data has not arrived: the same tree draws as a skeleton. */
export const loadingSlot = <T>(): DataSlot<T> => ({ isLoading: true })

/** Keeps an empty collection explicit while a refresh stays beside settled content. */
const slotOfItems = <T>(items: T, isValidating?: boolean): DataSlot<T> => {
    const validation = isValidating === undefined ? {} : { isValidating }
    return Array.isArray(items) && items.length === 0 ? { isEmpty: true, ...validation } : { items, ...validation }
}

/** Carries a slot's status over to what is made of its items, so a block words its data without touching the status. */
export const mapSlot = <T, U>(slot: DataSlot<T>, map: (items: T) => U): DataSlot<U> => {
    if ("items" in slot) return slotOfItems(map(slot.items), slot.isValidating)
    return slot
}

/**
 * Folds every read of one frame into its one slot: loading while any read still fetches its first data, an error when a
 * read failed without data, else the items the frame draws together. A key change reloads only the region keyed by it,
 * so a slot is never built from another slot's status.
 */
export const slotOfReads = <T>(reads: ReadonlyArray<SlotRead<unknown>>, items: () => T | undefined): DataSlot<T> => {
    if (reads.some((read) => read.data === undefined && read.isLoading)) return loadingSlot()
    const failed = reads.find((read) => read.data === undefined && read.error !== undefined)
    if (failed !== undefined) return isForbiddenFailure(failed.error) ? { isForbidden: true } : { isError: true }
    if (reads.some((read) => read.data === undefined)) return { isEmpty: true }
    const settled = items()
    if (settled === undefined) return { isEmpty: true }
    return slotOfItems(
        settled,
        reads.some((read) => read.isValidating === true),
    )
}

/**
 * Folds the state of one SWR read into a slot: the items once they arrived, an error when the read failed, loading only while a read is
 * really in flight (SWR `isLoading`), else empty. A read that does not fetch (a null key) is therefore empty, never an endless skeleton.
 */
export const slotOfSwr = <T>(read: SlotRead<T>): DataSlot<T> => {
    if (read.data !== undefined) return slotOfItems(read.data, read.isValidating)
    if (read.error !== undefined) return isForbiddenFailure(read.error) ? { isForbidden: true } : { isError: true }
    return read.isLoading ? loadingSlot() : { isEmpty: true }
}

/** One empty row, drawn as a skeleton while a desk's waiting list is read. */
export const WAITING_ROWS_PLACEHOLDER: ReadonlyArray<WorkbenchRowView> = [
    {
        id: "loading",
        title: "",
        description: "",
        badges: [],
        reason: null,
        amount: null,
        proposal: "",
        trace: null,
        expiry: null,
        primary: null,
        edit: null,
        menu: [],
        waitingFor: null,
    },
]
