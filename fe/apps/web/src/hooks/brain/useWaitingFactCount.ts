"use client"

import { mapSlot } from "@/hooks/slot"
import { factKeysOf } from "@/modules/brain"
import { useBrain } from "./useBrain"
import type { DataSlot } from "@/modules/types"

/** The view `useWaitingFactCount` returns. */
export interface WaitingFactCountView {
    slot: DataSlot<number>
    reload: () => undefined
}

/**
 * How many subjects and attributes wait for the owner, counted as the inbox and the rail count them. The count keeps the Brain read's
 * own status and retry: the view tells loading from none.
 */
export const useWaitingFactCount = (): WaitingFactCountView => {
    const { slot, reload } = useBrain()
    return {
        slot: mapSlot(
            slot,
            (brain) => factKeysOf(brain.facts).filter((one) => one.kind === "fresh" || one.kind === "conflict").length,
        ),
        reload,
    }
}
