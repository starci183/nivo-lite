"use client"

import { useConnectionGrantsBand } from "@/hooks/connectionsPanes"
import { useSepayChecklistView } from "./useSepayChecklistView"
import { useSepayConnection } from "./useSepayConnection"
import { useSepayPasteView } from "./useSepayPasteView"
import { useSepaySetupSteps } from "./useSepaySetupSteps"

/** What the three steps of a SePay connection that the form does not cover draw, in the words of the reader, and the commands behind them. */
interface SepayStepViews {
    readonly stepsLabel: string
    readonly steps: ReturnType<typeof useSepaySetupSteps>["steps"]
    readonly openSepay: ReturnType<typeof useSepaySetupSteps>["openSepay"]
    readonly paste: ReturnType<typeof useSepayPasteView>["view"]
    readonly checklist: ReturnType<typeof useSepayChecklistView>
    readonly grants: ReturnType<typeof useConnectionGrantsBand>
    readonly on: ReturnType<typeof useSepayPasteView>["on"] & {
        readonly toggle: (id: string, isOpen: boolean) => void
        readonly retry: () => void
    }
}

/** The setup steps of a SePay connection the form does not cover (the webhook on SePay, the test, the agents): the words and data of each body, read together so the steps draw as one list. */
export const useSepayStepViews = (connectionId: string): SepayStepViews => {
    const { retry } = useSepayConnection(connectionId)
    const setup = useSepaySetupSteps(connectionId)
    const paste = useSepayPasteView(connectionId)
    return {
        stepsLabel: setup.stepsLabel,
        steps: setup.steps.filter((step) => step.id !== "environment" && step.id !== "account"),
        openSepay: setup.openSepay,
        paste: paste.view,
        checklist: useSepayChecklistView(connectionId),
        grants: useConnectionGrantsBand(connectionId),
        on: {
            ...paste.on,
            retry,
            toggle: (id, isOpen) => {
                const step = setup.steps.find((candidate) => candidate.id === id)
                if (step !== undefined) setup.toggle(step.id, isOpen)
            },
        },
    }
}
