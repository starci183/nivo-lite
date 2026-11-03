"use client"

import { useConnectionRefusal } from "@/hooks/connections"
import { useZaloSetupSteps } from "@/hooks/zaloConnection"
import { ZaloSetupStepsBase } from "./component"

/** What the page hands the stepper: the connection of the url. */
interface ZaloSetupStepsProps {
    readonly connectionId: string
}

/** The connected stepper of the Zalo setup: where the owner stands, from the page read. */
export const ZaloSetupSteps = (props: ZaloSetupStepsProps) => {
    const view = useZaloSetupSteps(props.connectionId)
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    const current = view.steps.find((step) => step.isOpen) ?? view.steps[0]
    return (
        <ZaloSetupStepsBase
            props={{
                stepsLabel: view.stepsLabel,
                steps: view.steps.map((step) => ({ id: step.id, title: step.title })),
                currentStepId: current?.id ?? "",
            }}
        />
    )
}
