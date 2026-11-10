import { AlertDialog, DescriptionList, Input, Stack, Text } from "@starci/grammar/common"
import type { WorkspaceDeleteView } from "@/modules/types"

/** Copy and state the connected delete dialog supplies. */
export interface WorkspaceDeleteDialogBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        /** The restore-window line; shown only when the view has restore days. */
        readonly restoreText: string
        readonly fieldLabel: string
        readonly cancelLabel: string
        readonly confirmLabel: string
        readonly view: WorkspaceDeleteView
    }
    readonly on: {
        readonly change: (value: string) => void
        readonly confirm: () => void
        readonly close: () => void
    }
}

/** The impact rows, one term/value pair for each thing the deletion changes. */
const rowsOf = (props: WorkspaceDeleteDialogBaseProps) =>
    props.props.view.impact.map((row) => ({ id: row.label, term: row.label, description: row.value }))

/** Draws the deletion of a workspace: what it changes, how long it can be restored, and the typed name that unlocks it. */
export const WorkspaceDeleteDialogBase = (props: WorkspaceDeleteDialogBaseProps) => (
    <AlertDialog
        isOpen
        onOpenChange={(isOpen) => {
            if (!isOpen) props.on.close()
        }}
        title={props.props.title}
        description={props.props.description}
        tone="negative"
        cancelLabel={props.props.cancelLabel}
        confirmLabel={props.props.confirmLabel}
        isConfirmPending={props.props.view.isPending}
        isConfirmDisabled={!props.props.view.canConfirm}
        onConfirm={props.on.confirm}
        onCancel={props.on.close}
    >
        <Stack gap="row">
            <DescriptionList items={rowsOf(props)} />
            {props.props.view.restoreDays === null ? null : <Text size="sm">{props.props.restoreText}</Text>}
            <Input
                id="workspace-delete-name"
                name="workspaceName"
                label={props.props.fieldLabel}
                value={props.props.view.typed}
                onValueChange={props.on.change}
                isDisabled={props.props.view.isPending}
                autoFocus
            />
        </Stack>
    </AlertDialog>
)
