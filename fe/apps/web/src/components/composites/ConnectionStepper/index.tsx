import { PaneSection, Stepper } from "@starci/grammar/common"

/** Props for {@link ConnectionStepper}. */
type ConnectionStepperProps = {
    /** Names the progress landmark of the stepper. */
    readonly label: string
    readonly steps: ReadonlyArray<{ readonly id: string; readonly title: string }>
    /** The step the reader stands at; the first step when none matches. */
    readonly currentStepId: string
}

/** The dense stepper above the setup steps of a connection page, as a band of its pane. */
export const ConnectionStepper = (props: ConnectionStepperProps) => (
    <PaneSection>
        <Stepper
            label={props.label}
            size="dense"
            steps={props.steps.map((step) => ({ id: step.id, label: step.title }))}
            currentStepId={props.currentStepId}
        />
    </PaneSection>
)
