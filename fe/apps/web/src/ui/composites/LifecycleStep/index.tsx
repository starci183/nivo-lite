import { Text, Badge } from "@starci/grammar/common";



/** The settled lifecycle positions. */
export type LifecycleStepState = "done" | "current" | "upcoming"
/** Every settled lifecycle position, in the order a step renders. */
export const LIFECYCLE_STEP_STATES: ReadonlyArray<LifecycleStepState> = ["done", "current", "upcoming"] as const
/** Resolved copy and state for one lifecycle step. */
export type LifecycleStepData = { readonly ordinal: string; readonly label: string; readonly state: LifecycleStepState; readonly stateLabel: string }
/** Props for one lifecycle step. */
export type LifecycleStepProps = { readonly props: LifecycleStepData; readonly isLoading?: boolean }

const STATE_TONES: Readonly<Record<LifecycleStepState, "success" | "accent" | "neutral">> = { done: "success", current: "accent", upcoming: "neutral" }

/** Render one ordered lifecycle step. */
export const LifecycleStep = (props: LifecycleStepProps) => (
    <div>
        <Badge tone={STATE_TONES[props.props.state]} isSkeleton={props.isLoading}>{props.props.ordinal}</Badge>
        <Text size="sm" weight="semibold" isSkeleton={props.isLoading}>{props.props.label}</Text>
        <Text size="xs" tone="muted" isSkeleton={props.isLoading}>{props.props.stateLabel}</Text>
    </div>
)
