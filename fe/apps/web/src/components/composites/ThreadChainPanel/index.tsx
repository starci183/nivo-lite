import { Badge, EmptyNotice, SurfaceCard, Text, Timeline } from "@starci/grammar/common"
import type { PresentationState } from "@starci/grammar/common"
import type { ChainPanelView, StatusTone, ThreadChainLabels } from "@/modules/types"
import { PANEL_CLASS_NAME, SUMMARY_CLASS_NAME } from "./classNames"

/** What the panel draws. */
type ThreadChainPanelProps = {
    readonly view: ChainPanelView
    readonly labels: ThreadChainLabels
    /** The chain is still loading: the steps draw as waiting rows. */
    readonly isSkeleton: boolean
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
const Steps = (props: Pick<ThreadChainPanelProps, "view" | "labels" | "isSkeleton">) => {
    if (!props.isSkeleton && props.view.steps.length === 0) return <EmptyNotice message={props.labels.emptyMessage} />
    return (
        <Timeline
            label={props.labels.stepsLabel}
            isLoading={props.isSkeleton}
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
        <div className={SUMMARY_CLASS_NAME}>
            <Badge tone="neutral">{props.view.summaryLine}</Badge>
            {props.view.stateLine === "" ? null : <Badge tone={props.view.stateTone}>{props.view.stateLine}</Badge>}
        </div>
    )
}

/** The card that closes a chain every step of which was recorded; nothing while the chain runs. */
const Completion = (props: Pick<ThreadChainPanelProps, "view" | "labels">) => {
    if (!props.view.isComplete) return null
    return (
        <SurfaceCard label={props.labels.completeTitle} depth="nested" state="affirmative">
            <Text size="sm" tone="muted">
                {props.labels.completeHint}
            </Text>
        </SurfaceCard>
    )
}

/** The Execution chain: the summary line, where the chain stands, every step in order, and the completion card. */
export const ThreadChainPanel = (props: ThreadChainPanelProps) => (
    <div className={PANEL_CLASS_NAME}>
        <Summary view={props.view} />
        <Steps view={props.view} labels={props.labels} isSkeleton={props.isSkeleton} />
        <Completion view={props.view} labels={props.labels} />
    </div>
)
