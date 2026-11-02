import type { HiringViews } from "@/modules/types"

import { Button } from "@starci/grammar/common"

/** The words and state of the footer of a request dialog. */
interface HiringDialogFooterProps {
    readonly copy: HiringViews["workbenchCopy"]
    readonly sendLabel: string
    readonly isDone: boolean
    readonly canSend: boolean
    readonly isBusy: boolean
    readonly onSend: () => void
    readonly onClose: () => void
}

/** The footer of a request dialog: cancel (or done, once answered) and the send button until then. */
export const HiringDialogFooter = (props: HiringDialogFooterProps) => (
    <>
        <Button intent="dismiss" onPress={props.onClose}>
            {props.isDone ? props.copy.done : props.copy.cancel}
        </Button>
        {props.isDone ? null : (
            <Button
                intent="commit"
                isPending={props.isBusy}
                isDisabled={props.isBusy || !props.canSend}
                onPress={props.onSend}
            >
                {props.sendLabel}
            </Button>
        )}
    </>
)
