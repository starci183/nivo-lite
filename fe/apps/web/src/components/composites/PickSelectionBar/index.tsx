import { AlertDialog, Button, Cluster, Text } from "@starci/grammar/common"
import type { PickConfirmView, PickSelectionBarView } from "@/modules/types"

/** Props for {@link PickSelectionBar}. */
interface PickSelectionBarProps {
    readonly props: {
        readonly bar: PickSelectionBarView
        readonly confirm: PickConfirmView | null
    }
    readonly on: {
        readonly clear: () => void
        readonly askReject: () => void
        readonly askApprove: () => void
        readonly cancel: () => void
        readonly confirm: () => void
    }
}

/**
 * The bar at the top of a card of facts that can be ticked: "Selected 25 / 60 · 2 documents", then clear, reject and the one primary,
 * "Approve 25 facts". While nothing is ticked it says how to tick. Approving or rejecting together asks first.
 */
export const PickSelectionBar = (props: PickSelectionBarProps) => {
    const { bar, confirm } = props.props
    const hasPick = bar.count > 0 && bar.canWrite
    return (
        <Cluster gap="inline" justify="between" align="center">
            <Text isStrong={bar.count > 0} tone={bar.count > 0 ? "default" : "muted"} live="polite">
                {bar.summary}
            </Text>
            {hasPick ? (
                <Cluster gap="identity" label={bar.summary}>
                    <Button onPress={props.on.clear} intent="dismiss" isDisabled={bar.isPending} size="sm">
                        {bar.clearLabel}
                    </Button>
                    <Button onPress={props.on.askReject} intent="neutral" isDisabled={bar.isPending} size="sm">
                        {bar.rejectLabel}
                    </Button>
                    <Button onPress={props.on.askApprove} intent="commit" isPending={bar.isPending} size="sm">
                        {bar.approveLabel}
                    </Button>
                </Cluster>
            ) : null}
            {confirm === null ? null : (
                <AlertDialog
                    isOpen
                    onOpenChange={(open) => {
                        if (!open) props.on.cancel()
                    }}
                    tone={confirm.tone}
                    title={confirm.title}
                    description={confirm.description}
                    confirmLabel={confirm.confirmLabel}
                    cancelLabel={confirm.cancelLabel}
                    onConfirm={props.on.confirm}
                />
            )}
        </Cluster>
    )
}
