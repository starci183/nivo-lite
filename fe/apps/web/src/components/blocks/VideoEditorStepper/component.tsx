import { Alert, Button, Stepper } from "@starci/grammar/common"
import { STEPPER_BACK, STEPPER_PAGE } from "./classNames"

/** One step of the stepper. */
export interface VideoStepperStep {
    readonly id: string
    readonly label: string
    readonly isDisabled: boolean
}

/** Copy, state and handlers of the wizard header. */
export interface VideoEditorStepperBaseProps {
    readonly props: {
        readonly toLibrary: string
        readonly libraryHref: string
        readonly stepperLabel: string
        readonly steps: ReadonlyArray<VideoStepperStep>
        readonly current: string
        readonly viewOnly: string | null
    }
    readonly on: { readonly select: (id: string) => void }
}

/** Draws the wizard header: the way back to the library, the stepper and the view-only notice. */
export const VideoEditorStepperBase = (props: VideoEditorStepperBaseProps) => (
    <div className={STEPPER_PAGE}>
        <div className={STEPPER_BACK}>
            <Button intent="neutral" size="sm" href={props.props.libraryHref}>
                {props.props.toLibrary}
            </Button>
        </div>
        <Stepper
            label={props.props.stepperLabel}
            steps={props.props.steps}
            currentStepId={props.props.current}
            onStepSelect={props.on.select}
        />
        {props.props.viewOnly === null ? null : <Alert tone="cautionary" title={props.props.viewOnly} />}
    </div>
)
