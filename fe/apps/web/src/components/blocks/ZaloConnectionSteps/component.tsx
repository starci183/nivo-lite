import { Alert, Button } from "@starci/grammar/common"
import { ConnectionSteps, stepsWithBodies } from "@/components/composites/ConnectionSteps"
import { ConnectionGrantsBand, type ConnectionGrantsBandProps } from "@/components/frames/ConnectionGrantsBand"
import { ConnectionSavedFacts, type ConnectionSavedFactsProps } from "@/components/frames/ConnectionSavedFacts"
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

/** The words, data and commands of the five steps of a Zalo OA connection. */
export interface ZaloConnectionStepsBaseProps {
    readonly props: {
        readonly stepsLabel: string
        readonly steps: ReadonlyArray<ZaloStepView>
        readonly app: Pick<ConnectionSavedFactsProps, "facts" | "slotLabels">
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
        readonly changeSecret: (value: string) => void
        readonly saveSecret: () => void
        readonly authorize: () => void
        readonly pickGrant: (agentId: string, level: string) => void
        readonly assignGrant: (agentId: string) => void
        readonly retryGrants: () => void
    }
}

/**
 * Draws the five setup steps of a Zalo OA connection as one joined list with its stepper: each step keeps its own body (the saved app
 * keys, the addresses to paste into Zalo and the key to paste back, the authorization, the checks with the test send, the agents with
 * their levels) and its mark says where it stands.
 */
export const ZaloConnectionStepsBase = (props: ZaloConnectionStepsBaseProps) => {
    const { on } = props
    const { action } = props.props.authorize
    const bodies = {
        app: (
            <ConnectionSavedFacts
                facts={props.props.app.facts}
                slotLabels={props.props.app.slotLabels}
                onRetry={on.retry}
            />
        ),
        paste: (
            <ZaloPasteBody
                props={props.props.paste}
                on={{ retry: on.retry, changeSecret: on.changeSecret, saveSecret: on.saveSecret }}
            />
        ),
        authorize:
            props.props.authorize.notice === "" ? null : <Alert tone="negative" title={props.props.authorize.notice} />,
        check: <ZaloChecksBody props={props.props.checks} on={on} />,
        agents: (
            <ConnectionGrantsBand
                props={props.props.grants}
                on={{ pick: on.pickGrant, assign: on.assignGrant, retry: on.retryGrants }}
            />
        ),
    }
    const actions = {
        paste: (
            <Button intent="neutral" href={props.props.paste.openZalo.href} target="_blank" rel="noreferrer">
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
