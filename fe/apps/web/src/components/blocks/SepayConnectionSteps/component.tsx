import { Button, Text } from "@starci/grammar/common"
import { ConnectionSteps, stepsWithBodies } from "@/components/composites/ConnectionSteps"
import { ConnectionGrantsBand } from "@/components/frames/ConnectionGrantsBand"
import type { ConnectionGrantsBandProps } from "@/components/frames/ConnectionGrantsBand"
import { SepayAccountBody } from "@/components/frames/SepayAccountBody"
import type { SepayAccountBodyProps } from "@/components/frames/SepayAccountBody"
import { SepayChecklistBody } from "@/components/frames/SepayChecklistBody"
import type { SepayChecklistBodyProps } from "@/components/frames/SepayChecklistBody"
import { SepayEnvironmentBody } from "@/components/frames/SepayEnvironmentBody"
import type { SepayEnvironmentBodyProps } from "@/components/frames/SepayEnvironmentBody"
import { SepayPasteBody } from "@/components/frames/SepayPasteBody"
import type { SepayPasteBodyProps } from "@/components/frames/SepayPasteBody"

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
        readonly environment: SepayEnvironmentBodyProps["props"]
        readonly account: SepayAccountBodyProps["props"]
        readonly paste: SepayPasteBodyProps["props"]
        /** Opens the webhook page of SePay for the chosen environment in a new tab (the third step command). */
        readonly openSepay: { readonly label: string; readonly href: string }
        readonly checklist: SepayChecklistBodyProps["props"]
        /** How a credit is matched to an invoice, and what happens to one that is not. */
        readonly matching: string
        readonly grants: ConnectionGrantsBandProps["props"]
    }
    readonly on: SepayAccountBodyProps["on"] &
        SepayPasteBodyProps["on"] & {
            readonly toggle: (id: string, isOpen: boolean) => void
            readonly changeEnvironment: (environment: "test" | "live") => void
            readonly pickGrant: (agentId: string, level: string) => void
            readonly assignGrant: (agentId: string) => void
            readonly retryGrants: () => void
        }
}

/**
 * Draws the five setup steps of a SePay connection as one joined list with its stepper: each step keeps its own body (environment,
 * bank account, what to create on SePay, the test checklist, the agents with their levels) and its mark says where it stands.
 */
export const SepayConnectionStepsBase = (props: SepayConnectionStepsBaseProps) => {
    const { on } = props
    const bodies = {
        environment: (
            <SepayEnvironmentBody
                props={props.props.environment}
                on={{ change: on.changeEnvironment, retry: on.retry }}
            />
        ),
        account: (
            <SepayAccountBody
                props={props.props.account}
                on={{ retry: on.retry, bank: on.bank, account: on.account, holder: on.holder, save: on.save }}
            />
        ),
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
            <>
                <Text size="sm">{props.props.matching}</Text>
                <ConnectionGrantsBand
                    props={props.props.grants}
                    on={{ pick: on.pickGrant, assign: on.assignGrant, retry: on.retryGrants }}
                />
            </>
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
