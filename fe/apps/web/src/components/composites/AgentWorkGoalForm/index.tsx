import { Button, Input } from "@starci/grammar/common"
import { FORM_GROW, FORM_ROW } from "./classNames"

/** The field and command that add a goal. */
interface AgentWorkGoalFormProps {
    readonly label: string
    readonly placeholder: string
    readonly addLabel: string
    readonly value: string
    readonly canAdd: boolean
    readonly isSaving: boolean
    readonly isSkeleton: boolean
    readonly onChange: (value: string) => void
    readonly onAdd: () => void
}

/** The new goal field with its command. */
export const AgentWorkGoalForm = (props: AgentWorkGoalFormProps) => (
    <div className={FORM_ROW}>
        <div className={FORM_GROW}>
            <Input
                id="agent-work-goal"
                name="goal"
                label={props.label}
                placeholder={props.placeholder}
                value={props.value}
                isSkeleton={props.isSkeleton}
                isDisabled={props.isSaving}
                onValueChange={props.onChange}
            />
        </div>
        <Button
            intent="neutral"
            isSkeleton={props.isSkeleton}
            isPending={props.isSaving}
            isDisabled={!props.canAdd}
            onPress={props.onAdd}
        >
            {props.addLabel}
        </Button>
    </div>
)
