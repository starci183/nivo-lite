import { Button, Cluster } from "@starci/grammar/common"

/** The two commands that end an in-place add form of the Work tab. */
interface AgentWorkFormButtonsProps {
    readonly addLabel: string
    readonly cancelLabel: string
    readonly canAdd: boolean
    readonly isSaving: boolean
    readonly isLoading: boolean
    readonly onAdd: () => void
    readonly onCancel: () => void
}

/** Cancel (a quiet command) and the add command, at the end of the form. */
export const AgentWorkFormButtons = (props: AgentWorkFormButtonsProps) => (
    <Cluster gap="inline" justify="end">
        <Button intent="dismiss" isLoading={props.isLoading} isDisabled={props.isSaving} onPress={props.onCancel}>
            {props.cancelLabel}
        </Button>
        <Button
            intent="neutral"
            isLoading={props.isLoading}
            isPending={props.isSaving}
            isDisabled={!props.canAdd}
            onPress={props.onAdd}
        >
            {props.addLabel}
        </Button>
    </Cluster>
)
