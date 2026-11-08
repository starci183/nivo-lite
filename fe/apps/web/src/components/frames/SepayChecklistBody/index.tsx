import { Alert, Stepper, Text } from "@starci/grammar/common"
import type { StepperStep, StepperStepState } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { Icon } from "@/components/leaves/Icon"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** One step of the checklist as it is worded. */
interface SepayChecklistStep {
    readonly id: string
    readonly label: string
    /** The detail line under a step: what the door saw, or what the step will do in this environment. */
    readonly note: string
    readonly state: StepperStepState
    /** True for the step that waits on the webhook: it shows the spinner well. */
    readonly isWaiting: boolean
}

/** Props for {@link SepayChecklistBody}. */
export interface SepayChecklistBodyProps {
    readonly props: {
        readonly stepsLabel: string
        readonly waitingText: string
        readonly doneLabel: string
        readonly slot: DataSlot<ReadonlyArray<SepayChecklistStep>>
        readonly placeholder: ReadonlyArray<SepayChecklistStep>
        readonly labels: SlotLabels
    }
    readonly on: { readonly retry: () => void }
}

const descriptionOf = (note: string, isWaiting: boolean, waitingText: string) => {
    if (isWaiting) return <Alert tone="pending" title={waitingText} />
    if (note === "") return undefined
    return (
        <Text size="xs" tone="muted">
            {note}
        </Text>
    )
}

const stepsOf = (steps: ReadonlyArray<SepayChecklistStep>, waitingText: string): ReadonlyArray<StepperStep> =>
    steps.map(({ note, isWaiting, ...step }) => ({ ...step, description: descriptionOf(note, isWaiting, waitingText) }))

/** Draws the test steps inside the fourth setup step: a vertical stepper, each step true only when the webhook door really saw it. */
export const SepayChecklistBody = (props: SepayChecklistBodyProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={props.props.placeholder}
        labels={props.props.labels}
        onRetry={props.on.retry}
        render={(steps, isSkeleton) => {
            const current = steps.find((step) => step.state === "current") ?? steps.at(-1)
            return (
                <Stepper
                    label={props.props.stepsLabel}
                    orientation="vertical"
                    steps={stepsOf(steps, props.props.waitingText)}
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
            )
        }}
    />
)
