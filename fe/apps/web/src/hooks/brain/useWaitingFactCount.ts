"use client"

import { mapSlot } from "@/hooks/slot"
import { reviewBoardOf } from "@/modules/brain"
import { useBrain } from "./useBrain"
import type { DataSlot } from "@/modules/types"

/** The view `useWaitingFactCount` returns. */
export interface WaitingFactCountView {
    slot: DataSlot<number>
    reload: () => undefined
}

/** The review-card count keeps the Brain read's own status and retry: the view tells loading from none. */
export const useWaitingFactCount = (): WaitingFactCountView => {
    const { slot, reload } = useBrain()
    return { slot: mapSlot(slot, (brain) => reviewBoardOf(brain.facts).cards), reload }
}
