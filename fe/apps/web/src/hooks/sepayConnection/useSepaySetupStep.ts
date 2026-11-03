"use client"

import { setupStepViewOf } from "@/hooks/connectionPage"
import type { SepayStepId } from "@/modules/types"
import { useSepaySetupSteps } from "./useSepaySetupSteps"

type UseSepaySetupStepResult = {
    step: {
        ordinal: number
        title: string
        summary: string
        hint: string
        isOpen: boolean
    }
    openSepay: {
        label: string
        href: string
    }
    toggle: (isOpen: boolean) => void
}

/** One setup step of a SePay connection, in the words of the reader, with the command that opens or closes it. */
export const useSepaySetupStep = (connectionId: string, id: SepayStepId): UseSepaySetupStepResult => {
    const all = useSepaySetupSteps(connectionId)
    return {
        step: setupStepViewOf(all.steps, id),
        openSepay: all.openSepay,
        toggle: (isOpen: boolean): void => all.toggle(id, isOpen),
    }
}
