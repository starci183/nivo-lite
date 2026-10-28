import { Spinner, Stepper, SurfaceCard, Text } from "@starci/grammar/common"
import type { StepperStep, StepperStepState } from "@starci/grammar/common"
import { Icon } from "@/components/leaves/Icon"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { sepayChecklistClassNames as classNames } from "./classNames"

/** One step of the checklist as it is worded. */
export interface SepayChecklistStep {
    readonly id: string
    readonly label: string
    /** The detail line under a step: what the door saw, or what the step will do in this environment. */
    readonly note: string
    readonly state: StepperStepState
    /** True for the step that waits on the webhook: it shows the spinner well. */
    readonly isWaiting: boolean
}

/** Props for {@link SepayChecklistBase}. */
export interface SepayChecklistBaseProps {
    readonly props: {
        readonly title: string
        readonly stepsLabel: string
        readonly waitingText: string
        readonly waitingLabel: string
        readonly doneLabel: string
        readonly slot: DataSlot<ReadonlyArray<SepayChecklistStep>>
        readonly placeholder: ReadonlyArray<SepayChecklistStep>
        readonly labels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

/** The waiting copy of the current step. */
interface Waiting {
    readonly label: string
    readonly label: string
}

const descriptionOf = (note: string, isWaiting: boolean, waiting: Waiting) => {
    if (isWaiting) {
        return (
            <SurfaceCard ariaLabel={waiting.label}>
                <div className={classNames.well}>
                    <Spinner label={waiting.label} size="sm" />
                    <Text size="sm">{waiting.text}</Text>
                </div>
            </SurfaceCard>
        )
    }
    if (note === "") return undefined
    return (
        <Text size="xs" tone="muted">
            {note}
        </Text>
    )
}

const stepsOf = (steps: ReadonlyArray<SepayChecklistStep>, waiting: Waiting): ReadonlyArray<StepperStep> =>
    steps.map(({ note, isWaiting, ...step }) => ({ ...step, description: descriptionOf(note, isWaiting, waiting) }))

/** Draws the test checklist: a vertical stepper, each step true only when the webhook door really saw it. */
export const SepayChecklistBase = (props: SepayChecklistBaseProps) => {
    return (
        <SurfaceCard label={props.props.title} headingLevel={2}>
            <SlotView {...props.props} onRetry={props.on.retry}>
                {(steps, isSkeleton) => {
                    const current = steps.find((step) => step.state === "current") ?? steps[steps.length - 1]
                    return (
                        <div className={classNames.stack}>
                            <Stepper
                                label={props.props.stepsLabel}
                                orientation="vertical"
                                steps={stepsOf(steps, {
                                    text: props.props.waitingText,
                                    label: props.props.waitingLabel,
                                })}
                                currentStepId={current?.id ?? ""}
                                isLoading={isSkeleton}
                                stateLabel={(state) => (state === "complete" ? props.props.doneLabel : undefined)}
                                renderMarker={(_step, index, state) =>
                                    state === "complete" ? (
                                        <Icon props={{ name: "complete", ariaLabel: props.props.doneLabel }} />
                                    ) : (
                                        index + 1
                                    )
                                }
                            />
                        </div>
                    )
                }}
            </SlotView>
        </SurfaceCard>
    )
}
