import { AlertDialog, Button, EmptyNotice, Stack, SurfaceCard, Text } from "@starci/grammar/common"

/** Copy and state of the danger section that removes an agent. */
export interface AgentRemoveCardBaseProps {
    readonly props: {
        readonly title: string
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

/** Draws the removal of an agent as one row at the foot of the settings: what removing does, and the entry to the confirmation. */
export const AgentRemoveCardBase = (props: AgentRemoveCardBaseProps) => (
    <SurfaceCard
        kind="list"
        ariaLabel={props.props.title}
        empty={<EmptyNotice message={props.props.title} />}
        items={[
            {
                id: "remove",
                title: props.props.hint,
                detail: (
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
                ),
            },
        ]}
    />
)
