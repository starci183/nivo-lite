import { Alert, CheckboxGroup, Text } from "@starci/grammar/common"
import type { AgentStepView } from "@/modules/types"

/** What the last step draws and reports. */
type WizardAgentStepProps = AgentStepView & {
    readonly isDisabled?: boolean
    readonly onChange: (ids: ReadonlyArray<string>) => void
}

/** Last step: tick the workspace agents that work through this connection. */
export const WizardAgentStep = (props: WizardAgentStepProps) => (
    <>
        {props.notice === null ? null : <Alert tone="informative" title={props.notice} />}
        <Text size="sm" weight="semibold">
            {props.title}
        </Text>
        {props.agents.length === 0 ? (
            <Text size="sm">{props.none}</Text>
        ) : (
            <>
                <Text size="sm" tone="muted">
                    {props.hint}
                </Text>
                <CheckboxGroup
                    variant="secondary"
                    label={props.hint}
                    isLabelHidden
                    {...(props.isDisabled !== undefined && { isDisabled: props.isDisabled })}
                    options={props.agents.map((agent) => ({
                        value: agent.id,
                        label: agent.name,
                        ...(agent.description === undefined ? {} : { description: agent.description }),
                    }))}
                    value={[...props.value]}
                    onValueChange={(ids) => props.onChange(ids)}
                />
            </>
        )}
    </>
)
