import { Alert, SurfaceCard, Text } from "@starci/grammar/common"
import type { WholeCardAction } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { PIPELINE_CLASS_NAME, PIPELINE_REGION_CLASS_NAME, STEP_CLASS_NAME } from "./classNames"

/** One step of the pipeline, already worded: its figure, its note and the tab it opens. */
export interface StepView {
    readonly id: string
    readonly label: string
    readonly value: string
    readonly meta: string
    readonly href: string
    /** Something waits for the viewer here. */
    readonly isWaiting: boolean
}

/** The action that brings the brain up to date. */
interface MaintainView {
    readonly title: string
    readonly body: string
    readonly actionLabel: string
}

/** The pipeline as its slot carries it: the four steps, and the action that brings the brain up to date when something is due. */
export interface PipelineView {
    readonly steps: ReadonlyArray<StepView>
    /** Something is due: a scheduled value waits to take over or a value in force has ended. Nothing is drawn for it while undefined. */
    readonly maintain?: MaintainView | undefined
}

/** A pipeline of the same shape as a ready one: four steps with their figures. */
const PIPELINE_PLACEHOLDER: PipelineView = {
    steps: ["sources", "lessons", "review", "facts"].map((id) => ({
        id,
        label: "-",
        value: "0",
        meta: "-",
        href: "#",
        isWaiting: false,
    })),
}

/** Copy and figures the connected pipeline supplies. */
export interface BrainPipelineBaseProps {
    readonly props: {
        readonly label: string
        readonly pipeline: DataSlot<PipelineView>
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly maintain: () => void; readonly retry: () => void }
}

const wholeActionOf = (step: StepView): WholeCardAction => ({
    kind: "link",
    href: step.href,
    label: `${step.label}: ${step.value}`,
})

/** Draws how knowledge moves through the brain (taken in, learnt, reviewed, used): four figures, each opening its tab. */
export const BrainPipelineBase = (props: BrainPipelineBaseProps) => (
    <div className={PIPELINE_REGION_CLASS_NAME}>
        <SlotView
            slot={props.props.pipeline}
            placeholder={PIPELINE_PLACEHOLDER}
            labels={props.props.slotLabels}
            onRetry={props.on.retry}
        >
            {(pipeline, isSkeleton) => (
                <>
                    <div className={PIPELINE_CLASS_NAME} role="group" aria-label={props.props.label}>
                        {pipeline.steps.map((step) => (
                            <SurfaceCard
                                key={step.id}
                                state={step.isWaiting ? "cautionary" : "neutral"}
                                wholeAction={wholeActionOf(step)}
                            >
                                <div className={STEP_CLASS_NAME}>
                                    <Text size="xs" tone="muted">
                                        {step.label}
                                    </Text>
                                    <Text size="metric-lead" weight="semibold" isSkeleton={isSkeleton}>
                                        {step.value}
                                    </Text>
                                    <Text size="xs" tone="muted" isSkeleton={isSkeleton}>
                                        {step.meta}
                                    </Text>
                                </div>
                            </SurfaceCard>
                        ))}
                    </div>
                    {pipeline.maintain === undefined ? null : (
                        <Alert
                            tone="cautionary"
                            title={pipeline.maintain.title}
                            description={pipeline.maintain.body}
                            action={{ label: pipeline.maintain.actionLabel, onAction: props.on.maintain }}
                        />
                    )}
                </>
            )}
        </SlotView>
    </div>
)
