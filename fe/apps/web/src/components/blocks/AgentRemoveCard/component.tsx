import { SlotView } from "@nivo-lite/agent-sdk/client"
import { AlertDialog, Button } from "@starci/grammar/common"
import { AgentRemoveImpact } from "@/components/composites/AgentRemoveImpact"
import { FieldBlock } from "@/components/frames/FieldBlock"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** The sentences while they are read: three lines, so the dialog keeps the height of its plain confirmation. */
const IMPACT_PLACEHOLDER: ReadonlyArray<string> = [" ", " ", " "]

/** Copy and state of the danger field that removes an agent. */
export interface AgentRemoveCardBaseProps {
    readonly props: {
        /** The field title: a short noun ("Remove agent"). */
        readonly rowTitle: string
        readonly hint: string
        readonly actionLabel: string
        readonly dialogTitle: string
        /** What removing the agent erases and keeps, read while the dialog is open. */
        readonly impact: DataSlot<ReadonlyArray<string>>
        readonly impactLabels: SlotLabels
        readonly isOpen: boolean
        readonly cancelLabel: string
        readonly confirmLabel: string
        /** The person may remove the agent. */
        readonly canRemove: boolean
        readonly isRemoving: boolean
    }
    readonly on: {
        readonly remove: () => void
        readonly setOpen: (isOpen: boolean) => void
        readonly retryImpact: () => void
    }
}

/**
 * Draws the removal of an agent as one flat field at the foot of the settings: what removing does, and the danger button that opens the
 * confirmation. The confirmation states what is erased (loaded when it opens) and cannot be confirmed before it is known.
 */
export const AgentRemoveCardBase = (props: AgentRemoveCardBaseProps) => (
    <FieldBlock
        title={props.props.rowTitle}
        description={props.props.hint}
        trailing={
            <>
                <Button
                    intent="destructive"
                    step="entry"
                    size="sm"
                    isDisabled={!props.props.canRemove}
                    onPress={() => props.on.setOpen(true)}
                >
                    {props.props.actionLabel}
                </Button>
                <AlertDialog
                    isOpen={props.props.isOpen}
                    onOpenChange={props.on.setOpen}
                    title={props.props.dialogTitle}
                    tone="negative"
                    cancelLabel={props.props.cancelLabel}
                    confirmLabel={props.props.confirmLabel}
                    isConfirmPending={props.props.isRemoving}
                    isConfirmDisabled={!("items" in props.props.impact)}
                    onConfirm={props.on.remove}
                >
                    <SlotView
                        slot={props.props.impact}
                        placeholder={IMPACT_PLACEHOLDER}
                        labels={props.props.impactLabels}
                        errorLayout="band"
                        onRetry={props.on.retryImpact}
                        render={(lines) => <AgentRemoveImpact lines={lines} />}
                    />
                </AlertDialog>
            </>
        }
    />
)
