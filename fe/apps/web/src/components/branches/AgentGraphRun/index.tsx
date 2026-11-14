import { Alert, Badge, Button, Text, Timeline, Section } from "@starci/grammar/common"
import type { AgentGraphRunView } from "@/modules/types"

/** A run traced on the version that decided it, and the way back to the map. */
type AgentGraphRunProps = {
    readonly view: AgentGraphRunView
    readonly isLoading: boolean
    readonly onBack: () => void
}

/**
 * One run read as a story: what happened step by step, where the model and the books disagreed, and what the run left out. The
 * graph paints the path it took while this is open.
 */
export const AgentGraphRun = (props: AgentGraphRunProps) => (
    <Section
        title={props.view.title}
        caption={props.view.summary}
        isLoading={props.isLoading}
        action={
            <Badge tone="success" isLoading={props.isLoading}>
                {props.view.outcome}
            </Badge>
        }
        headingLevel={3}
    >
        {props.view.mismatch === "" ? null : <Alert title={props.view.mismatch} tone="cautionary" />}
        <Timeline
            label={props.view.stepsLabel}
            isLoading={props.isLoading}
            items={props.view.steps.map((step) => ({
                id: step.id,
                title: step.text,
                timeLabel: step.time,
                ...(step.note === "" ? {} : { description: step.note }),
            }))}
        />
        <Text size="xs" tone="muted" isLoading={props.isLoading}>
            {props.view.skipped}
        </Text>
        <Button intent="neutral" size="sm" isLoading={props.isLoading} onPress={props.onBack}>
            {props.view.backLabel}
        </Button>
    </Section>
)
