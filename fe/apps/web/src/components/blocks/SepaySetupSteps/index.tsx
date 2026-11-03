"use client"

import { useConnectionRefusal } from "@/hooks/connections"
import { useSepaySetupSteps } from "@/hooks/sepayConnection"
import { SepaySetupStepsBase } from "./component"

/** What the page hands the stepper: the connection of the url. */
interface SepaySetupStepsProps {
    readonly connectionId: string
}

/** The connected stepper of the SePay setup: where the owner stands, from the connection read. */
export const SepaySetupSteps = (props: SepaySetupStepsProps) => {
    const view = useSepaySetupSteps(props.connectionId)
    const current = view.steps.find((step) => step.isOpen) ?? view.steps[0]
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <SepaySetupStepsBase
            props={{
                stepsLabel: view.stepsLabel,
                steps: view.steps.map((step) => ({ id: step.id, title: step.title })),
                currentStepId: current?.id ?? "",
            }}
        />
    )
}
