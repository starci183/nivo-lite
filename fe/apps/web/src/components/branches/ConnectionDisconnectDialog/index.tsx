import { AlertDialog } from "@starci/grammar/common"

/** What the disconnect question says and whether its answer is being saved. */
interface DisconnectConfirm {
    readonly isOpen: boolean
    readonly title: string
    readonly description: string
    readonly confirmLabel: string
    readonly cancelLabel: string
    readonly isPending: boolean
}

/** Props for {@link ConnectionDisconnectDialog}. */
type ConnectionDisconnectDialogProps = {
    readonly confirm: DisconnectConfirm
    readonly onConfirm: () => void
    /** Closes the question without disconnecting (cancel, escape, a click outside). */
    readonly onDismiss: () => void
}

/** The question a disconnect asks first: what stops working, and the one destructive answer. */
export const ConnectionDisconnectDialog = (props: ConnectionDisconnectDialogProps) => (
    <AlertDialog
        isOpen={props.confirm.isOpen}
        onOpenChange={(open) => {
            if (!open) props.onDismiss()
        }}
        title={props.confirm.title}
        description={props.confirm.description}
        tone="negative"
        confirmLabel={props.confirm.confirmLabel}
        cancelLabel={props.confirm.cancelLabel}
        isConfirmPending={props.confirm.isPending}
        onConfirm={props.onConfirm}
        onCancel={props.onDismiss}
    />
)
