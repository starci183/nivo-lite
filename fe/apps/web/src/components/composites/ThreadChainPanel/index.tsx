import { Alert, EmptyNotice, Stack, Text, Timeline } from "@starci/grammar/common"
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
                description: [step.description, step.statusLabel].filter((part) => part !== "").join(" · "),
                state: STATE_OF_TONE[step.tone],
            }))}
        />
    )
}

/** The summary line and where the chain stands (a band in the state's tone); nothing while the chain is empty. */
const Summary = (props: Pick<ThreadChainPanelProps, "view" | "isLoading">) => {
    if (props.view.summaryLine === "") return null
    return (
        <Stack gap="row">
            <Text size="sm" tone="muted" isLoading={props.isLoading}>
                {props.view.summaryLine}
            </Text>
            {props.view.stateLine === "" ? null : (
                <Alert
                    title={props.view.stateLine}
                    tone={STATE_OF_TONE[props.view.stateTone]}
                    isLoading={props.isLoading}
                />
            )}
        </Stack>
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
        <Summary view={props.view} isLoading={props.isLoading} />
        <Steps view={props.view} labels={props.labels} isLoading={props.isLoading} />
        <Completion view={props.view} labels={props.labels} />
    </Stack>
)
