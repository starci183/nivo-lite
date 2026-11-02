import type { HiringViews, HiringActions } from "@/modules/types"

import { Alert, Button, Dialog, Text, Textarea, Stack } from "@starci/grammar/common"

/** The words and state of the reject dialog. */
interface HiringRejectDialogProps {
    readonly props: HiringViews["rejectFields"]
    readonly on: HiringActions["rejectActions"]
}

/** The dialog that asks for the reason before a candidate is rejected: rejecting is always a person's decision. */
export const HiringRejectDialog = (props: HiringRejectDialogProps) => {
    const { copy, reason, error } = props.props
    const { on } = props
    return (
        <Dialog
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            size="md"
            title={copy.title}
            closeLabel={copy.closeLabel}
            description={copy.hint}
            footer={<HiringRejectDialogFooter {...props} />}
        >
            <Stack gap="row">
                {error === null ? null : <Alert tone="negative" title={copy.failed} description={error} />}
                <Textarea label={copy.reasonLabel} rows={3} value={reason} onValueChange={on.reason} />
                <Text size="sm" tone="muted">
                    {copy.kept}
                </Text>
            </Stack>
        </Dialog>
    )
}

/** Keeps the dialog footer component stable as its fields change. */
const HiringRejectDialogFooter = (props: HiringRejectDialogProps) => {
    const { copy, canConfirm, isBusy } = props.props
    const { on } = props
    return (
        <>
            <Button intent="dismiss" onPress={on.close}>
                {copy.cancelLabel}
            </Button>
            <Button intent="commit" isPending={isBusy} isDisabled={isBusy || !canConfirm} onPress={on.confirm}>
                {copy.confirmLabel}
            </Button>
        </>
    )
}
