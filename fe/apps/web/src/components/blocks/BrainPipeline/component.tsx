import { Alert, DescriptionList, Meter, SurfaceCard, Text, TextAction } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { PIPELINE_REGION_CLASS_NAME } from "./classNames"

/** One step of the pipeline, already worded: its figure and its note. */
export interface StepView {
    readonly id: string
    readonly label: string
    readonly value: string
    readonly meta: string
}

/** The meter of the workspace's raw document allowance. */
interface UsageView {
    readonly label: string
    readonly value: number
    readonly max: number
    readonly valueLabel: string
    readonly tone: "affirmative" | "cautionary" | "negative"
}

/** The action that brings the brain up to date. */
interface MaintainView {
    readonly title: string
    readonly body: string
    readonly actionLabel: string
}

/** The one line that says what to do next, linked to the tab where it is done. */
interface NextView {
    readonly label: string
    readonly href: string
}

/** The pipeline as its slot carries it: the four steps, and the action that brings the brain up to date when something is due. */
export interface PipelineView {
    readonly steps: ReadonlyArray<StepView>
    /** Facts wait for the owner: the line that sends them to the review tab. Nothing is drawn for it while undefined. */
    readonly next?: NextView | undefined
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
    })),
}

/** Copy and figures the connected pipeline supplies. */
export interface BrainPipelineBaseProps {
    readonly props: {
        readonly label: string
        /** The allowance meter, the second band of the figures card; nothing until the usage is known. */
        readonly usage: UsageView | undefined
        readonly pipeline: DataSlot<PipelineView>
        readonly slotLabels: SlotLabels
    }
    readonly on: { readonly maintain: () => void; readonly retry: () => void }
}

/**
 * Draws how knowledge moves through the brain (taken in, learnt, reviewed, used) as one card of figures (card.md
 * "figures"): a stat strip of the four steps, with the raw document allowance meter as its second band, and the action
 * that brings the brain up to date under the card when something is due.
 */
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
                    <SurfaceCard ariaLabel={props.props.label}>
                        <div className={PIPELINE_REGION_CLASS_NAME}>
                            <DescriptionList
                                layout="stat-strip"
                                isLoading={isSkeleton}
                                items={pipeline.steps.map((step) => ({
                                    id: step.id,
                                    term: step.label,
                                    description: step.value,
                                    meta: step.meta,
                                }))}
                            />
                            {props.props.usage === undefined ? null : (
                                <Meter
                                    label={props.props.usage.label}
                                    value={props.props.usage.value}
                                    minValue={0}
                                    maxValue={props.props.usage.max}
                                    valueLabel={props.props.usage.valueLabel}
                                    tone={props.props.usage.tone}
                                />
                            )}
                        </div>
                    </SurfaceCard>
                    {pipeline.next === undefined ? null : (
                        <Text>
                            <TextAction href={pipeline.next.href}>{pipeline.next.label}</TextAction>
                        </Text>
                    )}
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
