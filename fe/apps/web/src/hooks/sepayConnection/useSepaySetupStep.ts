"use client"

import { setupStepViewOf } from "@/hooks/connectionPage"
import type { SepayStepId } from "@/modules/types"
import { useSepaySetupSteps } from "./useSepaySetupSteps"

/** One setup step of a SePay connection, in the words of the reader, with the command that opens or closes it. */
export const useSepaySetupStep = (connectionId: string, id: SepayStepId) => {
    const all = useSepaySetupSteps(connectionId)
    return {
        step: setupStepViewOf(all.steps, id),
        openSepay: all.openSepay,
        toggle: (isOpen: boolean) => all.toggle(id, isOpen),
    }
}
