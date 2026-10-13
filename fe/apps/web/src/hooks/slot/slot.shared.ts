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
