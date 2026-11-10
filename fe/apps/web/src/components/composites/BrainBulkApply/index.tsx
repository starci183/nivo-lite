import { AlertDialog, Button, Stack } from "@starci/grammar/common"
import type { BulkApplyView } from "@/modules/types"

/** Props for {@link BrainBulkApplyBase}. */
interface BrainBulkApplyBaseProps {
    readonly props: BulkApplyView
    readonly on: {
        readonly ask: (sourceId: string) => void
        readonly cancel: () => void
        readonly confirm: () => void
    }
}

/**
 * One command per internal document whose safe facts wait, and the question asked before they are applied together. Conflicted
 * facts are not counted here; they stay for a person, one by one.
 */
export const BrainBulkApplyBase = (props: BrainBulkApplyBaseProps) => {
    const { groups, confirm, pendingId } = props.props
    if (groups.length === 0) return null
    return (
        <Stack gap="row">
            {groups.map((group) => (
                <Button
                    key={group.id}
                    intent="alternative"
                    size="sm"
                    isPending={pendingId === group.id}
                    isDisabled={pendingId !== null && pendingId !== group.id}
                    onPress={() => props.on.ask(group.id)}
                >
                    {group.label}
                </Button>
            ))}
            {confirm === null ? null : (
                <AlertDialog
                    isOpen
                    onOpenChange={(open) => {
                        if (!open) props.on.cancel()
                    }}
                    tone="informative"
                    title={confirm.title}
                    description={confirm.description}
                    confirmLabel={confirm.confirmLabel}
                    cancelLabel={confirm.cancelLabel}
                    onConfirm={props.on.confirm}
                />
            )}
        </Stack>
    )
}
