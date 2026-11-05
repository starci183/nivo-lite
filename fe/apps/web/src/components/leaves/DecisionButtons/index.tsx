import { Button, Cluster } from "@starci/grammar/common"
import type { ReactNode } from "react"

/** One command of the decision group. */
interface DecisionCommand {
    readonly label: string
    readonly onPress: () => void
}

/** What the decision group draws and asks. */
interface DecisionButtonsProps {
    /** Says no: the dismiss button, first. */
    readonly reject: DecisionCommand
    /** Changes the draft before sending: the alternative button with a pencil, in the middle. Absent for a decision with nothing to edit. */
    readonly edit?: DecisionCommand & { readonly icon: ReactNode }
    /** Says yes: the one commit button, last. */
    readonly approve: DecisionCommand & { readonly isDisabled?: boolean }
    /** Which command is being sent: its button shows the pending state and every button is held until it settles. */
    readonly pending: "approve" | "reject" | null
    readonly size?: "sm" | "md"
}

/**
 * The one decision group of every approval, in the order of the mockups (CTA-5): Reject as dismiss, Edit as alternative with a
 * pencil, Approve as commit. Office drafts, thread approvals and lead drafts all draw their decision through it.
 */
export const DecisionButtons = (props: DecisionButtonsProps) => {
    const isBusy = props.pending !== null
    const size = props.size ?? "md"
    return (
        <Cluster gap="row">
            <Button
                intent="dismiss"
                size={size}
                isPending={props.pending === "reject"}
                isDisabled={isBusy}
                onPress={props.reject.onPress}
            >
                {props.reject.label}
            </Button>
            {props.edit === undefined ? null : (
                <Button
                    intent="alternative"
                    size={size}
                    isDisabled={isBusy}
                    startContent={props.edit.icon}
                    onPress={props.edit.onPress}
                >
                    {props.edit.label}
                </Button>
            )}
            <Button
                intent="commit"
                size={size}
                isPending={props.pending === "approve"}
                isDisabled={isBusy || props.approve.isDisabled === true}
                onPress={props.approve.onPress}
            >
                {props.approve.label}
            </Button>
        </Cluster>
    )
}
