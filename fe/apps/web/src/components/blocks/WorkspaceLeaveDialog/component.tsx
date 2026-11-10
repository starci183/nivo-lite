import { AlertDialog, DescriptionList } from "@starci/grammar/common"
import type { WorkspaceLeaveView } from "@/modules/types"

/** Copy and state the connected leave dialog supplies. */
export interface WorkspaceLeaveDialogBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly roleLabel: string
        readonly workLabel: string
        readonly reentryLabel: string
        readonly reentryValue: string
        readonly stayLabel: string
        readonly leaveLabel: string
        readonly view: WorkspaceLeaveView
    }
    readonly on: {
        readonly confirm: () => void
        readonly close: () => void
    }
}

/** The details rows: the role, the work in hand (hidden when null), and what re-entry needs. */
const rowsOf = (props: WorkspaceLeaveDialogBaseProps) => {
    const { view } = props.props
    const work =
        view.workInHand === null ? [] : [{ id: "work", term: props.props.workLabel, description: view.workInHand }]
    return [
        { id: "role", term: props.props.roleLabel, description: view.role },
        ...work,
        { id: "reentry", term: props.props.reentryLabel, description: props.props.reentryValue },
    ]
}

/** Draws the question a member answers before leaving a workspace: what they lose, and the two ways out. */
export const WorkspaceLeaveDialogBase = (props: WorkspaceLeaveDialogBaseProps) => (
    <AlertDialog
        isOpen
        onOpenChange={(isOpen) => {
            if (!isOpen) props.on.close()
        }}
        title={props.props.title}
        description={props.props.description}
        tone="negative"
        cancelLabel={props.props.stayLabel}
        confirmLabel={props.props.leaveLabel}
        isConfirmPending={props.props.view.isPending}
        onConfirm={props.on.confirm}
        onCancel={props.on.close}
    >
        <DescriptionList items={rowsOf(props)} />
    </AlertDialog>
)
