import { Button, Dialog, Input } from "@starci/grammar/common"
import { FORM_CLASS_NAME } from "./classNames"

/** Copy and state of the dialog that names a new instance of an agent type. */
export interface AddInstanceDialogProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly closeLabel: string
        readonly nameLabel: string
        readonly nameHint: string
        readonly createLabel: string
        readonly name: string
        readonly error: string | undefined
        readonly isPending: boolean
        readonly canCreate: boolean
    }
    readonly on: {
        readonly setName: (value: string) => void
        readonly create: () => void
        readonly close: () => void
    }
}

/** The add dialog: one name field (one column), then the new instance opens on its own Setup tab. */
export const AddInstanceDialog = (props: AddInstanceDialogProps) => (
    <Dialog
        isOpen
        onOpenChange={(open) => {
            if (!open && !props.props.isPending) props.on.close()
        }}
        size="sm"
        title={props.props.title}
        description={props.props.description}
        closeLabel={props.props.closeLabel}
        isDismissable={!props.props.isPending}
        footer={
            <>
                <Button intent="neutral" isDisabled={props.props.isPending} onPress={props.on.close}>
                    {props.props.closeLabel}
                </Button>
                <Button
                    intent="commit"
                    isPending={props.props.isPending}
                    isDisabled={!props.props.canCreate}
                    onPress={props.on.create}
                >
                    {props.props.createLabel}
                </Button>
            </>
        }
    >
        <div className={FORM_CLASS_NAME}>
            <Input
                id="agent-instance-name"
                name="name"
                label={props.props.nameLabel}
                hint={props.props.nameHint}
                isRequired
                isDisabled={props.props.isPending}
                value={props.props.name}
                onValueChange={props.on.setName}
                isError={props.props.error !== undefined}
                errorMessage={props.props.error}
            />
        </div>
    </Dialog>
)
