import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { z } from "zod"
import type { ValidatingMark } from "./slots.types"

/** The validating mark a ready slot carries over to what is made of it. */
const validatingOf = (slot: ValidatingMark): ValidatingMark =>
    slot.isValidating === undefined ? {} : { isValidating: slot.isValidating }

/** Reads the items of a ready slot through a schema; data that does not fit is a failed read, never half a block. */
export const parsedSlot = <T>(slot: DataSlot<unknown>, schema: z.ZodType<T>): DataSlot<T> => {
    if (!("items" in slot)) return slot
    const parsed = schema.safeParse(slot.items)
    return parsed.success ? { items: parsed.data, ...validatingOf(slot) } : { isError: true }
}

/** What is made of the items of a ready slot; a null result says the block has nothing to draw, which is an empty slot. */
export const derivedSlot = <T, U>(slot: DataSlot<T>, pick: (items: T) => U | null): DataSlot<U> => {
    if (!("items" in slot)) return slot
    const picked = pick(slot.items)
    return picked === null ? { isEmpty: true, ...validatingOf(slot) } : { items: picked, ...validatingOf(slot) }
}

/** The same slot, empty when the picked rows are none. */
export const rowsSlot = <T extends { readonly rows: ReadonlyArray<unknown> }>(slot: DataSlot<T>): DataSlot<T> =>
    derivedSlot(slot, (view) => (view.rows.length === 0 ? null : view))
