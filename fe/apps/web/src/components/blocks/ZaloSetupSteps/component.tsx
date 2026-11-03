import { ConnectionStepper } from "@/components/composites/ConnectionStepper"

/** Props for {@link ZaloSetupStepsBase}. */
export interface ZaloSetupStepsBaseProps {
    readonly props: {
        /** Names the stepper above the steps. */
        readonly stepsLabel: string
        readonly steps: ReadonlyArray<{ readonly id: string; readonly title: string }>
        /** The step the reader stands at. */
        readonly currentStepId: string
    }
}

/**
 * Draws the progress of the setup of a Zalo OA connection as a dense stepper in the order the back end needs it. Each step is its own
 * band below, drawn by its own block.
 */
export const ZaloSetupStepsBase = (props: ZaloSetupStepsBaseProps) => (
    <ConnectionStepper
        label={props.props.stepsLabel}
        steps={props.props.steps}
        currentStepId={props.props.currentStepId}
    />
)
