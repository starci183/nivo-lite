import { Alert, Button, Dialog, Text, Textarea } from "@starci/grammar/common"
import type { HiringSay } from "@/modules/types"
import { FORM_CLASS_NAME } from "./classNames"

/** The words and state of the reject dialog. */
export interface HiringRejectDialogProps {
    readonly props: {
        readonly say: HiringSay
        readonly name: string
        readonly reason: string
        readonly canConfirm: boolean
        readonly isBusy: boolean
        readonly error: string | null
    }
    readonly on: {
        readonly reason: (value: string) => void
        readonly confirm: () => void
        readonly close: () => void
    }
}

/** The dialog that asks for the reason before a candidate is rejected: rejecting is always a person's decision. */
export const HiringRejectDialog = (props: HiringRejectDialogProps) => {
    const { say, name, reason, error } = props.props
    const { on } = props
    return (
        <Dialog
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            size="md"
            title={say("rejectTitle", { name })}
            closeLabel={say("close")}
            description={say("rejectHint")}
            footer={<HiringRejectDialogFooter {...props} />}
        >
            <div className={FORM_CLASS_NAME}>
                {error === null ? null : <Alert tone="negative" title={say("rejectFailed")} description={error} />}
                <Textarea label={say("rejectReason")} rows={3} value={reason} onValueChange={on.reason} />
                <Text size="sm" tone="muted">
                    {say("rejectKept")}
                </Text>
            </div>
        </Dialog>
    )
}

/** Keeps the dialog footer component stable as its fields change. */
const HiringRejectDialogFooter = (props: HiringRejectDialogProps) => {
    const { say, canConfirm, isBusy } = props.props
    const { on } = props
    return (
        <>
            <Button intent="dismiss" onPress={on.close}>
                {say("cancel")}
            </Button>
            <Button intent="commit" isPending={isBusy} isDisabled={isBusy || !canConfirm} onPress={on.confirm}>
                {say("rejectConfirm")}
            </Button>
        </>
    )
}
