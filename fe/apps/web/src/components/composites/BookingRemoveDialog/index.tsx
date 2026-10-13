import { AlertDialog } from "@starci/grammar/common"

/** What the removal dialog of a setup row draws and reports. */
type BookingRemoveDialogProps = {
    readonly title: string
    readonly description: string
    readonly confirmLabel: string
    readonly cancelLabel: string
    readonly onConfirm: () => void
    readonly onCancel: () => void
}

/** The question that stands before removing a service or a resource. */
export const BookingRemoveDialog = (props: BookingRemoveDialogProps) => (
    <AlertDialog
        isOpen
        onOpenChange={(open) => {
            if (!open) props.onCancel()
        }}
        tone="negative"
        title={props.title}
        description={props.description}
        confirmLabel={props.confirmLabel}
        cancelLabel={props.cancelLabel}
        onConfirm={props.onConfirm}
    />
)
