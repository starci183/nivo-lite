import { AgentWorkFormButtons } from "@/components/branches/AgentWorkFormButtons"
import { Input, Stack } from "@starci/grammar/common"

/** The field and command that add a goal. */
interface AgentWorkGoalFormProps {
    readonly label: string
    readonly placeholder: string
    readonly addLabel: string
    readonly cancelLabel: string
    readonly value: string
    readonly canAdd: boolean
    readonly isSaving: boolean
    readonly isLoading: boolean
    readonly onChange: (value: string) => void
    readonly onAdd: () => void
    readonly onCancel: () => void
}

/** The new goal field with its command. */
export const AgentWorkGoalForm = (props: AgentWorkGoalFormProps) => (
    <Stack gap="row">
        <Input
            id="agent-work-goal"
            name="goal"
            label={props.label}
            placeholder={props.placeholder}
            value={props.value}
            isLoading={props.isLoading}
            isDisabled={props.isSaving}
            onValueChange={props.onChange}
        />
        <AgentWorkFormButtons
            addLabel={props.addLabel}
            cancelLabel={props.cancelLabel}
            canAdd={props.canAdd}
            isSaving={props.isSaving}
            isLoading={props.isLoading}
            onAdd={props.onAdd}
            onCancel={props.onCancel}
        />
    </Stack>
)
