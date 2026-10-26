import { Button } from "@starci/grammar/common"
import type { HiringSay } from "@/hooks/hiring"

/** The words and state of the footer of a request dialog. */
interface HiringDialogFooterProps {
    readonly say: HiringSay
    readonly sendKey: string
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
            {props.say(props.isDone ? "done" : "cancel")}
        </Button>
        {props.isDone ? null : (
            <Button
                intent="commit"
                isPending={props.isBusy}
                isDisabled={props.isBusy || !props.canSend}
                onPress={props.onSend}
            >
                {props.say(props.sendKey)}
            </Button>
        )}
    </>
)
