import { ChoiceChips, Form, Select, Stack, Textarea } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { FormActions } from "@/components/composites/FormActions"
import type { AskAgentOption, BrainAskView } from "@/modules/types"

/** An agent of the same shape as a ready one. */
const AGENTS_PLACEHOLDER: ReadonlyArray<AskAgentOption> = [{ id: "placeholder", label: "-" }]

/** What the question form draws and calls. */
interface AskQuestionFormProps {
    readonly props: BrainAskView["props"]
    readonly on: BrainAskView["on"]
}

/** What the fields over the question draw. */
interface ChoicesProps extends AskQuestionFormProps {
    readonly agents: ReadonlyArray<AskAgentOption>
    readonly isLoading: boolean
}

/** The fields over the question: the agent to ask as and who the question is asked as (a customer, or the team). */
const Choices = (props: ChoicesProps) => {
    const { props: view, on } = props
    return (
        <Stack gap="row">
            <Select
                label={view.copy.agentLabel}
                name="agent"
                options={props.agents}
                placeholder={view.copy.agentPlaceholder}
                value={view.agentId}
                isLoading={props.isLoading}
                isDisabled={view.isPending}
                onValueChange={on.setAgent}
            />
            <ChoiceChips
                label={view.copy.audienceLabel}
                options={view.audienceOptions}
                value={view.audience}
                isLoading={props.isLoading}
                empty={null}
                onValueChange={on.setAudience}
            />
        </Stack>
    )
}

/**
 * The form that asks the question: the agent and who is asking, the question, and the one command that searches. It reads only. While
 * the agents load every field draws its skeleton; with no agent installed the form says so in place.
 */
export const AskQuestionForm = (props: AskQuestionFormProps) => {
    const { props: view, on } = props
    return (
        <SlotView
            slot={view.agents}
            placeholder={AGENTS_PLACEHOLDER}
            labels={view.agentsLabels}
            onRetry={on.retry}
            render={(agents, isLoading) => (
                <Form label={view.copy.headTitle} onSubmit={on.ask} isPending={view.isPending}>
                    <Stack gap="section">
                        <Choices {...props} agents={agents} isLoading={isLoading} />
                        <Textarea
                            id="brain-ask-question"
                            name="question"
                            label={view.copy.questionLabel}
                            rows={2}
                            maxLength={500}
                            placeholder={view.copy.questionPlaceholder}
                            value={view.question}
                            isDisabled={view.isPending}
                            isLoading={isLoading}
                            onValueChange={on.setQuestion}
                        />
                        <FormActions
                            failTitle={view.copy.failTitle}
                            error={view.error}
                            submitLabel={view.copy.submitLabel}
                            isPending={view.isPending}
                            isLoading={isLoading}
                        />
                    </Stack>
                </Form>
            )}
        />
    )
}
