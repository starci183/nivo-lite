"use client"

import { reviewBoardOf } from "@/modules/brain"
import { useBrain } from "./useBrain"

/** How many facts read from the documents wait for the owner to review them. */
export const useWaitingFactCount = (): number => {
    const { brain } = useBrain()
    return reviewBoardOf(brain?.facts ?? []).cards
}
