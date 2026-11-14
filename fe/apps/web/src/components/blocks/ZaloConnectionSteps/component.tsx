import { Alert, Button } from "@starci/grammar/common"
import { ConnectionSteps, stepsWithBodies } from "@/components/composites/ConnectionSteps"
import { ConnectionGrantsBand, type ConnectionGrantsBandProps } from "@/components/frames/ConnectionGrantsBand"
import { ZaloChecksBody, type ZaloChecksBodyProps } from "@/components/frames/ZaloChecksBody"
import { ZaloPasteBody, type ZaloPasteBodyProps } from "@/components/frames/ZaloPasteBody"

/** One setup step as it is worded: its title, the summary beside it, the guidance under it, and where it stands. */
interface ZaloStepView {
    readonly id: string
    readonly title: string
    readonly summary: string
    readonly hint: string
    readonly isOpen: boolean
    readonly isDone: boolean
    /** The step stands on a failure (the token expired, a check fails). */
    readonly isProblem: boolean
}

/** The words, data and commands of the four steps of a Zalo OA connection that the form does not cover. */
export interface ZaloConnectionStepsBaseProps {
    readonly props: {
        readonly stepsLabel: string
        readonly steps: ReadonlyArray<ZaloStepView>
        readonly paste: ZaloPasteBodyProps["props"] & {
            readonly openZalo: { readonly label: string; readonly href: string }
        }
        readonly authorize: {
            /** Why the last authorization did not start, worded by the back end; empty when there is none. */
            readonly notice: string
            /** Sends the owner to Zalo to grant the OA; absent for everyone else, whom the back end refuses. */
            readonly action?: { readonly label: string; readonly isPending: boolean; readonly isNext: boolean }
        }
        readonly checks: ZaloChecksBodyProps["props"]
        readonly grants: ConnectionGrantsBandProps["props"]
    }
    readonly on: ZaloChecksBodyProps["on"] & {
        readonly toggle: (id: string, isOpen: boolean) => void
        readonly authorize: () => void
        readonly removeGrant: (agentId: string) => void
        readonly assignGrant: (agentId: string) => void
        readonly retryGrants: () => void
    }
}

/**
 * Draws the four setup steps of a Zalo OA connection that the form does not cover, as one joined list with its stepper: the callback
 * address to paste into Zalo, the authorization, the checks with the test send, and the agents bound to it. The app id, the webhook
 * address and the OA Secret Key are fields of the form; the app keys are fixed when the connection is made.
 */
export const ZaloConnectionStepsBase = (props: ZaloConnectionStepsBaseProps) => {
    const { on } = props
    const { action } = props.props.authorize
    const bodies = {
        paste: (
            <ZaloPasteBody
                props={props.props.paste}
                on={{ retry: on.retry }}
            />
        ),
        authorize:
            props.props.authorize.notice === "" ? null : <Alert tone="negative" title={props.props.authorize.notice} />,
        check: <ZaloChecksBody props={props.props.checks} on={on} />,
        agents: (
            <ConnectionGrantsBand
                props={props.props.grants}
                on={{ remove: on.removeGrant, assign: on.assignGrant, retry: on.retryGrants }}
            />
        ),
    }
    const actions = {
        paste: (
            <Button endArrow intent="neutral" href={props.props.paste.openZalo.href} target="_blank" rel="noreferrer">
                {props.props.paste.openZalo.label}
            </Button>
        ),
        authorize:
            action === undefined ? undefined : (
                <Button
                    intent={action.isNext ? "commit" : "neutral"}
                    isPending={action.isPending}
                    onPress={on.authorize}
                >
                    {action.label}
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
