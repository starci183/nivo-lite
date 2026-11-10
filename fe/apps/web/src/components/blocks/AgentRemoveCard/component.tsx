import { AlertDialog, Button, Stack, Text } from "@starci/grammar/common"
import { FieldBlock } from "@/components/frames/FieldBlock"

/** Copy and state of the danger field that removes an agent. */
export interface AgentRemoveCardBaseProps {
    readonly props: {
        /** The field title: a short noun ("Remove agent"). */
        readonly rowTitle: string
        readonly hint: string
        readonly actionLabel: string
        readonly dialogTitle: string
        readonly lines: ReadonlyArray<string>
        readonly cancelLabel: string
        readonly confirmLabel: string
        /** The person may remove the agent. */
        readonly canRemove: boolean
        readonly isRemoving: boolean
    }
    readonly on: { readonly remove: () => void }
}

/** Draws the removal of an agent as one flat field at the foot of the settings: what removing does, and the danger button that opens the confirmation. */
export const AgentRemoveCardBase = (props: AgentRemoveCardBaseProps) => (
    <FieldBlock
        title={props.props.rowTitle}
        description={props.props.hint}
        trailing={
            <AlertDialog
                title={props.props.dialogTitle}
                tone="negative"
                cancelLabel={props.props.cancelLabel}
                confirmLabel={props.props.confirmLabel}
                isConfirmPending={props.props.isRemoving}
                onConfirm={props.on.remove}
                trigger={
                    <Button intent="destructive" step="entry" size="sm" isDisabled={!props.props.canRemove}>
                        {props.props.actionLabel}
                    </Button>
                }
            >
                <Stack gap="inline">
                    {props.props.lines.map((line) => (
                        <Text key={line} size="sm">
                            {line}
                        </Text>
                    ))}
                </Stack>
            </AlertDialog>
        }
    />
)
