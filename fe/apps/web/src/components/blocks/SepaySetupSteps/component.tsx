import { Button } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { ConnectionSteps } from "@/components/composites/ConnectionSteps"
import type { SepayStepId } from "@/modules/types"

/** One setup step as it is worded: its title, the summary beside it, the guidance under it, and whether it is open. */
export interface SepaySetupStepView {
    readonly id: SepayStepId
    readonly title: string
    readonly summary: string
    readonly hint: string
    readonly isOpen: boolean
}

/** Props for {@link SepaySetupStepsBase}. */
export interface SepaySetupStepsBaseProps {
    /** The body of each step, connected by the page. */
    readonly shape: Readonly<Record<SepayStepId, ReactNode>>
    readonly props: {
        readonly steps: ReadonlyArray<SepaySetupStepView>
        /** Opens the webhook page of SePay for the chosen environment in a new tab. */
        readonly openSepay: { readonly label: string; readonly href: string }
    }
    readonly on: { readonly toggle: (id: SepayStepId, isOpen: boolean) => void }
}

/**
 * Draws the setup of a SePay connection as numbered steps in the order the back end needs them (environment, bank account, the
 * webhook on SePay, the test, matching and the agent), each a band of the main pane whose head says whether the step is done.
 */
export const SepaySetupStepsBase = (props: SepaySetupStepsBaseProps) => (
    <ConnectionSteps
        steps={props.props.steps.map((step) => ({
            ...step,
            body: props.shape[step.id],
            actions:
                step.id === "paste" ? (
                    <Button intent="neutral" href={props.props.openSepay.href} target="_blank" rel="noreferrer">
                        {props.props.openSepay.label}
                    </Button>
                ) : undefined,
        }))}
        onToggle={(id, isOpen) => {
            const step = props.props.steps.find((candidate) => candidate.id === id)
            if (step !== undefined) props.on.toggle(step.id, isOpen)
        }}
    />
)
