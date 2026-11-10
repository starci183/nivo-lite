import { Button, Dialog, Input, Stack } from "@starci/grammar/common"
import type { WorkspaceRenameView } from "@/modules/types"

/** The rename dialog: the view and the callbacks. */
interface WorkspaceRenameDialogProps {
    readonly props: WorkspaceRenameView
    readonly on: {
        readonly change: (value: string) => void
        readonly submit: () => void
        readonly close: () => void
    }
}

/** The small rename dialog: one name field with its length hint, then cancel and save. */
export const WorkspaceRenameDialog = (props: WorkspaceRenameDialogProps) => {
    const view = props.props
    const on = props.on
    return (
        <Dialog
            isOpen
            onOpenChange={(open) => {
                if (!open && !view.isPending) on.close()
            }}
            size="sm"
            title={view.title}
            description={view.description}
            closeLabel={view.cancelLabel}
            isDismissable={!view.isPending}
            footer={
                <>
                    <Button intent="neutral" isDisabled={view.isPending} onPress={on.close}>
                        {view.cancelLabel}
                    </Button>
                    <Button intent="commit" isPending={view.isPending} onPress={on.submit}>
                        {view.saveLabel}
                    </Button>
                </>
            }
        >
            <Stack gap="row">
                <Input
                    id={`workspace-rename-${view.name}`}
                    name="name"
                    label={view.fieldLabel}
                    description={view.hint}
                    isRequired
                    isDisabled={view.isPending}
                    value={view.value}
                    onValueChange={on.change}
                    isInvalid={view.error !== undefined}
                    errorMessage={view.error}
                />
            </Stack>
        </Dialog>
    )
}
