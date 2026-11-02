import type { VideoEditorActions, VideoEditorViews } from "@/modules/types"
type VideoEditStepsFields = VideoEditorViews["stepper"]
type VideoEditStepsActions = VideoEditorActions["stepper"]

interface VideoEditStepsProps extends VideoEditStepsFields {
    readonly isLoading: boolean
    readonly on: VideoEditStepsActions
}
import { Alert, Button, Stepper, Stack, Cluster } from "@starci/grammar/common"

/** Draws the wizard header: the way back to the library, the stepper and the view-only notice. */
export const VideoEditSteps = (props: VideoEditStepsProps) => (
    <Stack gap="section">
        <Cluster gap="inline" align="center">
            <Button isLoading={props.isLoading} intent="neutral" size="sm" href={props.libraryHref}>
                {props.toLibrary}
            </Button>
        </Cluster>
        <Stepper
            isLoading={props.isLoading}
            label={props.stepperLabel}
            steps={props.steps}
            currentStepId={props.current}
            onStepSelect={props.on.select}
        />
        {props.viewOnly === null ? null : <Alert tone="cautionary" title={props.viewOnly} />}
    </Stack>
)
