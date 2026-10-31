import { Alert, Badge, Button, SectionHeader, Text, Timeline } from "@starci/grammar/common"
import type { AgentGraphRunView } from "@/modules/types"

/** A run traced on the version that decided it, and the way back to the map. */
type AgentGraphRunProps = {
    readonly view: AgentGraphRunView
    readonly isSkeleton: boolean
    readonly onBack: () => void
}

/**
 * One run read as a story: what happened step by step, where the model and the books disagreed, and what the run left out. The
 * graph paints the path it took while this is open.
 */
export const AgentGraphRun = (props: AgentGraphRunProps) => (
    <>
        <SectionHeader
            level={3}
            title={props.view.title}
            description={props.view.summary}
            isSkeleton={props.isSkeleton}
            meta={
                <Badge tone="success" isSkeleton={props.isSkeleton}>
                    {props.view.outcome}
                </Badge>
            }
        />
        {props.view.mismatch === "" ? null : <Alert title={props.view.mismatch} tone="cautionary" appearance="soft" />}
        <Timeline
            label={props.view.stepsLabel}
            isLoading={props.isSkeleton}
            items={props.view.steps.map((step) => ({
                id: step.id,
                title: step.text,
                timeLabel: step.time,
                ...(step.note === "" ? {} : { description: step.note }),
            }))}
        />
        <Text size="xs" tone="muted" isSkeleton={props.isSkeleton}>
            {props.view.skipped}
        </Text>
        <Button intent="neutral" size="sm" isSkeleton={props.isSkeleton} onPress={props.onBack}>
            {props.view.backLabel}
        </Button>
    </>
)
