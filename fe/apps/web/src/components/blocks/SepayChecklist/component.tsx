import { SurfaceCard, Text } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { StatusRows } from "@/components/composites/StatusRows"
import type { DataSlot, SepayStepState, SlotLabels } from "@/modules/types"
import { sepayChecklistClassNames as classNames } from "./classNames"

/** One step of the checklist as it is worded. */
export interface SepayChecklistStep {
    readonly id: string
    readonly title: string
    readonly note: string
    readonly state: SepayStepState
    readonly stateLabel: string
}

/** Props for {@link SepayChecklistBase}. */
export interface SepayChecklistBaseProps {
    readonly props: {
        readonly title: string
        readonly slot: DataSlot<ReadonlyArray<SepayChecklistStep>>
        readonly placeholder: ReadonlyArray<SepayChecklistStep>
        readonly labels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

const TONES = { done: "success", active: "warning", pending: "neutral" } as const

const rowsOf = (steps: ReadonlyArray<SepayChecklistStep>) =>
    steps.map((step) => ({
        id: step.id,
        title: step.title,
        note:
            step.note === "" ? undefined : (
                <Text size="xs" tone="muted">
                    {step.note}
                </Text>
            ),
        badgeLabel: step.stateLabel,
        badgeTone: TONES[step.state],
    }))

/** Draws the test checklist: each step true only when the webhook door really saw it. */
export const SepayChecklistBase = (props: SepayChecklistBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <SlotView {...props.props} onRetry={props.on.retry}>
            {(steps, isSkeleton) => (
                <div className={classNames.stack}>
                    <StatusRows rows={rowsOf(steps)} isSkeleton={isSkeleton} />
                </div>
            )}
        </SlotView>
    </SurfaceCard>
)
