import { AlertDialog } from "@starci/grammar/common"

/** The words and commands of one destructive confirmation of the SePay connection page. */
type SepayConfirmProps = {
    readonly isOpen: boolean
    readonly title: string
    readonly description: string
    readonly confirmLabel: string
    readonly cancelLabel: string
    readonly isPending: boolean
    readonly onConfirm: () => void
    readonly onDismiss: () => void
}

/** The negative confirmation the SePay page asks before it disconnects or issues a new key: nothing happens until it is confirmed. */
export const SepayConfirm = (props: SepayConfirmProps) => (
    <AlertDialog
        isOpen={props.isOpen}
        onOpenChange={(open) => {
            if (!open) props.onDismiss()
        }}
        tone="negative"
        title={props.title}
        description={props.description}
        confirmLabel={props.confirmLabel}
        cancelLabel={props.cancelLabel}
        isConfirmPending={props.isPending}
        onConfirm={props.onConfirm}
    />
)
