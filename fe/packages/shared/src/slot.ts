import { slotOfRead, type DataSlot, type SlotRead } from "@nivo-lite/agent-sdk/client"
import { isForbiddenFailure } from "./failure"

/** Folds the state of one SWR read into a slot, through the SDK recipe and this app's failure vocabulary. */
export const slotOfSwr = <T>(read: SlotRead<T>): DataSlot<T> => slotOfRead(read, isForbiddenFailure)
