import { slotOfRead } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotRead } from "@/modules/types"
import { isForbiddenFailure } from "@/modules/failure"

/** Folds the state of one SWR read into a slot, through the SDK recipe and this app's failure vocabulary. */
export const slotOfSwr = <T>(read: SlotRead<T>): DataSlot<T> => slotOfRead(read, isForbiddenFailure)
