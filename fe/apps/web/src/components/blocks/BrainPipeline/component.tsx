import { useMemo } from "react"
import { Alert, SurfaceCard, Text } from "@starci/grammar/common"
import type { WholeCardAction } from "@starci/grammar/common"
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

/** Copy and figures the connected pipeline supplies. */
export interface BrainPipelineBaseProps {
    readonly props: {
        readonly label: string
        readonly steps: ReadonlyArray<StepView>
        /** The figures are loading: the labels stay, the values are skeletons. */
        readonly isSkeleton: boolean
        /** Something is due: a scheduled value waits to take over or a value in force has ended. Nothing is drawn for it while undefined. */
        readonly maintain?: MaintainView | undefined
    }
    readonly on: { readonly maintain: () => void }
}

const wholeActionOf = (step: StepView): WholeCardAction => ({
    kind: "link",
    href: step.href,
    label: `${step.label}: ${step.value}`,
})

/** Draws how knowledge moves through the brain (taken in, learnt, reviewed, used): four figures, each opening its tab. */
export const BrainPipelineBase = (props: BrainPipelineBaseProps) => {
    const cards = useMemo(
        () => props.props.steps.map((step) => ({ step, action: wholeActionOf(step) })),
        [props.props.steps],
    )
    return (
        <div className={PIPELINE_REGION_CLASS_NAME}>
            <div className={PIPELINE_CLASS_NAME} role="group" aria-label={props.props.label}>
                {cards.map(({ step, action }) => (
                    <SurfaceCard key={step.id} state={step.isWaiting ? "cautionary" : "neutral"} wholeAction={action}>
                        <div className={STEP_CLASS_NAME}>
                            <Text size="xs" tone="muted">
                                {step.label}
                            </Text>
                            <Text size="metric-lead" weight="semibold" isSkeleton={props.props.isSkeleton}>
                                {step.value}
                            </Text>
                            <Text size="xs" tone="muted" isSkeleton={props.props.isSkeleton}>
                                {step.meta}
                            </Text>
                        </div>
                    </SurfaceCard>
                ))}
            </div>
            {props.props.maintain === undefined ? null : (
                <Alert
                    tone="cautionary"
                    title={props.props.maintain.title}
                    description={props.props.maintain.body}
                    action={{ label: props.props.maintain.actionLabel, onAction: props.on.maintain }}
                />
            )}
        </div>
    )
}
