import type { HiringViews, HiringActions } from "@/modules/types"

import { Button, Text, Textarea } from "@starci/grammar/common"
import { HiringDialogShell } from "@/components/branches/HiringDialogShell"

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
        <HiringDialogShell
            size="md"
            title={copy.title}
            closeLabel={copy.closeLabel}
            description={copy.hint}
            footer={<HiringRejectDialogFooter {...props} />}
            errorTitle={copy.failed}
            error={error}
            onClose={on.close}
            body={
                <>
                    <Textarea label={copy.reasonLabel} rows={3} value={reason} onValueChange={on.reason} />
                    <Text size="sm" tone="muted">
                        {copy.kept}
                    </Text>
                </>
            }
        />
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
