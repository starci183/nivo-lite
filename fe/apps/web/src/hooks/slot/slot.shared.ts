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

/** Folds the state of one SWR read into a slot: loading until the first answer, an error when the read failed, else the items. */
export const slotOfSwr = <T>(read: Pick<SWRResponse<T>, "data" | "error" | "isLoading">): DataSlot<T> => {
    if (read.data !== undefined) return { items: read.data }
    if (read.error !== undefined) return { isError: true }
    return { isLoading: true }
}
