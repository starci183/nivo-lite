import { Button } from "@starci/grammar/common"
import { ConnectionSteps, stepsWithBodies } from "@/components/composites/ConnectionSteps"
import { ConnectionGrantsBand, type ConnectionGrantsBandProps } from "@/components/frames/ConnectionGrantsBand"
import { SepayChecklistBody, type SepayChecklistBodyProps } from "@/components/frames/SepayChecklistBody"
import { SepayPasteBody, type SepayPasteBodyProps } from "@/components/frames/SepayPasteBody"

/** One setup step as it is worded: its title, the summary beside it, the guidance under it, and where it stands. */
interface SepayStepView {
    readonly id: string
    readonly title: string
    readonly summary: string
    readonly hint: string
    readonly isOpen: boolean
    readonly isDone: boolean
}

/** The words, data and commands of the five steps of a SePay connection. */
export interface SepayConnectionStepsBaseProps {
    readonly props: {
        readonly stepsLabel: string
        readonly steps: ReadonlyArray<SepayStepView>
        readonly paste: SepayPasteBodyProps["props"]
        /** Opens the webhook page of SePay for the chosen environment in a new tab (the third step command). */
        readonly openSepay: { readonly label: string; readonly href: string }
        readonly checklist: SepayChecklistBodyProps["props"]
        readonly grants: ConnectionGrantsBandProps["props"]
    }
    readonly on: SepayPasteBodyProps["on"] & {
            readonly retry: () => void
            readonly toggle: (id: string, isOpen: boolean) => void
            readonly removeGrant: (agentId: string) => void
            readonly assignGrant: (agentId: string) => void
            readonly retryGrants: () => void
        }
}

/**
 * Draws the three setup steps of a SePay connection that the form does not cover, as one joined list with its stepper: what to
 * create on SePay (the webhook address and key to paste, and the reveal / new key control), the test checklist, and the agents bound
 * to it. The environment and the bank account are fields of the form.
 */
export const SepayConnectionStepsBase = (props: SepayConnectionStepsBaseProps) => {
    const { on } = props
    const bodies = {
        paste: (
            <SepayPasteBody
                props={props.props.paste}
                on={{
                    retry: on.retry,
                    askRotate: on.askRotate,
                    confirmRotate: on.confirmRotate,
                    dismissRotate: on.dismissRotate,
                    copyKey: on.copyKey,
                }}
            />
        ),
        test: <SepayChecklistBody props={props.props.checklist} on={{ retry: on.retry }} />,
        agents: (
            <ConnectionGrantsBand
                props={props.props.grants}
                on={{ remove: on.removeGrant, assign: on.assignGrant, retry: on.retryGrants }}
            />
        ),
    }
    const actions = {
        paste: (
            <Button endArrow intent="neutral" href={props.props.openSepay.href} target="_blank" rel="noreferrer">
                {props.props.openSepay.label}
            </Button>
        ),
    }
    return (
        <ConnectionSteps
            label={props.props.stepsLabel}
            onToggle={on.toggle}
            steps={stepsWithBodies(props.props.steps, bodies, actions)}
        />
    )
}
