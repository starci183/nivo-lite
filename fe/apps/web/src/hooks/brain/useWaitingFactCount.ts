"use client"

import { mapSlot } from "@/hooks/slot"
import { reviewBoardOf } from "@/modules/brain"
import { useBrain } from "./useBrain"

/** The review-card count keeps the Brain read's own status and retry: the view tells loading from none. */
export const useWaitingFactCount = () => {
    const { slot, reload } = useBrain()
    return { slot: mapSlot(slot, (brain) => reviewBoardOf(brain.facts).cards), reload }
}
