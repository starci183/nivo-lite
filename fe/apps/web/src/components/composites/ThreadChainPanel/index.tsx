import { Alert, Badge, EmptyNotice, Timeline, Cluster, Stack } from "@starci/grammar/common"
import type { PresentationState } from "@starci/grammar/common"
import type { ChainPanelView, StatusTone, ThreadChainLabels } from "@/modules/types"
/** What the panel draws. */
type ThreadChainPanelProps = {
    readonly view: ChainPanelView
    readonly labels: ThreadChainLabels
    /** The chain is still loading: the steps draw as waiting rows. */
    readonly isLoading: boolean
}

/** The presentation state a status tone stands for. */
const STATE_OF_TONE: Record<StatusTone, PresentationState> = {
    neutral: "neutral",
    accent: "informative",
    success: "affirmative",
    warning: "pending",
    danger: "negative",
}

/** The steps of the chain in order, or the empty notice when it has none. */
const Steps = (props: Pick<ThreadChainPanelProps, "view" | "labels" | "isLoading">) => {
    if (!props.isLoading && props.view.steps.length === 0) return <EmptyNotice message={props.labels.emptyMessage} />
    return (
        <Timeline
            label={props.labels.stepsLabel}
            isLoading={props.isLoading}
            items={props.view.steps.map((step) => ({
                id: step.id,
                title: step.title,
                description: step.description,
                timeLabel: step.statusLabel,
                state: STATE_OF_TONE[step.tone],
            }))}
        />
    )
}

/** The summary line and where the chain stands; nothing while the chain is empty. */
const Summary = (props: Pick<ThreadChainPanelProps, "view">) => {
    if (props.view.summaryLine === "") return null
    return (
        <Cluster gap="inline">
            <Badge tone="neutral">{props.view.summaryLine}</Badge>
            {props.view.stateLine === "" ? null : <Badge tone={props.view.stateTone}>{props.view.stateLine}</Badge>}
        </Cluster>
    )
}

/** The card that closes a chain every step of which was recorded; nothing while the chain runs. */
const Completion = (props: Pick<ThreadChainPanelProps, "view" | "labels">) => {
    if (!props.view.isComplete) return null
    return <Alert title={props.labels.completeTitle} description={props.labels.completeHint} tone="affirmative" />
}

/** The Execution chain: the summary line, where the chain stands, every step in order, and the completion card. */
export const ThreadChainPanel = (props: ThreadChainPanelProps) => (
    <Stack gap="section">
        <Summary view={props.view} />
        <Steps view={props.view} labels={props.labels} isLoading={props.isLoading} />
        <Completion view={props.view} labels={props.labels} />
    </Stack>
)
