import type { DataSlot, ForbiddenTest, SlotRead } from "./slot.types"

/** A slot whose data has not arrived: the same tree draws as a skeleton. */
export const loadingSlot = <T>(): DataSlot<T> => ({ isLoading: true })

/** Keeps an empty collection explicit while a refresh stays beside settled content. */
const slotOfItems = <T>(items: T, isValidating: boolean | undefined): DataSlot<T> => {
    const validation = isValidating === undefined ? {} : { isValidating }
    return Array.isArray(items) && items.length === 0 ? { isEmpty: true, ...validation } : { items, ...validation }
}

/** Carries a slot's status over to what is made of its items, so a block words its data without touching the status. */
export const mapSlot = <T, U>(slot: DataSlot<T>, map: (items: T) => U): DataSlot<U> => {
    if ("items" in slot) return slotOfItems(map(slot.items), slot.isValidating)
    return slot
}

/** A failed read: forbidden when the host says so, an error otherwise. */
const failedSlot = <T>(error: unknown, isForbidden: ForbiddenTest): DataSlot<T> =>
    isForbidden(error) ? { isForbidden: true } : { isError: true }

/**
 * Folds every read of one frame into its one slot: loading while any read still fetches its first data, a failure when a read failed
 * without data, else the items the frame draws together.
 */
export const slotOfReads = <T>(
    reads: ReadonlyArray<SlotRead<unknown>>,
    items: () => T | undefined,
    isForbidden: ForbiddenTest,
): DataSlot<T> => {
    if (reads.some((read) => read.data === undefined && read.isLoading)) return loadingSlot()
    const failed = reads.find((read) => read.data === undefined && read.error !== undefined)
    if (failed !== undefined) return failedSlot(failed.error, isForbidden)
    if (reads.some((read) => read.data === undefined)) return { isEmpty: true }
    const settled = items()
    if (settled === undefined) return { isEmpty: true }
    return slotOfItems(
        settled,
        reads.some((read) => read.isValidating === true),
    )
}

/**
 * Folds the state of one read into a slot: the items once they arrived, a failure when the read failed, loading only while a read is
 * really in flight, else empty. A read that does not fetch is therefore empty, never an endless skeleton.
 */
export const slotOfRead = <T>(read: SlotRead<T>, isForbidden: ForbiddenTest): DataSlot<T> => {
    if (read.data !== undefined) return slotOfItems(read.data, read.isValidating)
    if (read.error !== undefined) return failedSlot(read.error, isForbidden)
    return read.isLoading ? loadingSlot() : { isEmpty: true }
}
