import { slotOfRead, slotOfReads as slotOfReadsWith } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, WorkbenchRowView, SlotRead } from "@/modules/types"
import { isForbiddenFailure } from "@/modules/failure"

export { loadingSlot, mapSlot } from "@nivo-lite/agent-sdk/client"

/** The SDK's slot recipe bound to this app's failure vocabulary: one implementation, shared with every module package. */
export const slotOfReads = <T>(reads: ReadonlyArray<SlotRead<unknown>>, items: () => T | undefined): DataSlot<T> =>
    slotOfReadsWith(reads, items, isForbiddenFailure)

/** Folds the state of one SWR read into a slot, through the SDK recipe and this app's failure vocabulary. */
export const slotOfSwr = <T>(read: SlotRead<T>): DataSlot<T> => slotOfRead(read, isForbiddenFailure)

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

/**
 * The page-level "first load" flag of skeleton coherence: true while any of the page's slots has no data yet, so every region
 * draws its skeleton at once and none shows data beside a skeleton. Hand it to `PaneHead` (`isLoading`), `PaneList`, `PaneBody`
 * (`isWaiting`) and every input (never pre-filled while it is true). Only a region that depends on a user action reloads alone.
 */
export const isWaitingOf = (...slots: ReadonlyArray<DataSlot<unknown>>): boolean =>
    slots.some((slot) => "isLoading" in slot)
