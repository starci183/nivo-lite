import type { SWRResponse } from "swr"
import type { DataSlot } from "@/modules/types"

/** A slot whose data has not arrived: the same tree draws as a skeleton. */
export const loadingSlot = <T>(): DataSlot<T> => ({ isLoading: true })

/** Carries a slot's status over to what is made of its items, so a block words its data without touching the status. */
export const mapSlot = <T, U>(slot: DataSlot<T>, map: (items: T) => U): DataSlot<U> => ({
    isLoading: slot.isLoading,
    isForbidden: slot.isForbidden,
    isError: slot.isError,
    items: slot.items === undefined ? undefined : map(slot.items),
})

/** The part of an SWR read a slot folds: the error stays `unknown`, as SWR types it `any`. */
type SlotRead<T> = Pick<SWRResponse<T>, "data" | "isLoading"> & { readonly error: unknown }

/**
 * Folds the state of one SWR read into a slot: the items once they arrived, an error when the read failed, loading only while a read is
 * really in flight (SWR `isLoading`), else empty. A read that does not fetch (a null key) is therefore empty, never an endless skeleton.
 */
export const slotOfSwr = <T>(read: SlotRead<T>): DataSlot<T> => {
    if (read.data !== undefined) return { items: read.data }
    if (read.error !== undefined) return { isError: true }
    return read.isLoading ? { isLoading: true } : {}
}
