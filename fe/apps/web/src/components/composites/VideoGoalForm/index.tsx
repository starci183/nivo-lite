import type { VideoEditorActions, VideoEditorViews } from "@/modules/types"
type VideoGoalFormFields = VideoEditorViews["goal"]
type VideoGoalFormActions = VideoEditorActions["goal"]

interface VideoGoalFormProps extends VideoGoalFormFields {
    readonly isLoading: boolean
    readonly on: VideoGoalFormActions
}
import { Button, Input, ChoiceChips, RadioGroup, SurfaceCard, Stack, Cluster } from "@starci/grammar/common"
import { VideoErrorAlert } from "@/components/leaves/VideoErrorAlert"

/** Draws step one: what the video is for, its frame, its length and its working title. */
export const VideoGoalForm = (props: VideoGoalFormProps) => (
    <Stack gap="row">
        <VideoErrorAlert message={props.error} dismissLabel={props.dismissLabel} onDismiss={props.on.dismissError} />
        <SurfaceCard isLoading={props.isLoading} label={props.heading}>
            <Stack gap="row">
                <RadioGroup
                    isLoading={props.isLoading}
                    label={props.heading}
                    isLabelHidden
                    value={props.goal}
                    isDisabled={props.disabled}
                    options={props.goals}
                    onValueChange={props.on.goal}
                />
                <ChoiceChips
                    isLoading={props.isLoading}
                    label={props.aspectLabel}
                    empty={props.aspectLabel}
                    value={props.aspect}
                    options={props.aspects.map((option) => ({ ...option, isDisabled: props.disabled }))}
                    onValueChange={props.on.aspect}
                />
                <ChoiceChips
                    isLoading={props.isLoading}
                    label={props.durationLabel}
                    empty={props.durationLabel}
                    value={props.seconds}
                    options={props.durations.map((option) => ({ ...option, isDisabled: props.disabled }))}
                    onValueChange={props.on.seconds}
                />
                <Input
                    isLoading={props.isLoading}
                    id="video-title"
                    name="title"
                    label={props.titleLabel}
                    description={props.titleHint}
                    value={props.title}
                    isDisabled={props.disabled}
                    onValueChange={props.on.title}
                />
                <Cluster gap="inline" justify="end">
                    <Button
                        isLoading={props.isLoading}
                        intent="commit"
                        isPending={props.pending}
                        isDisabled={props.disabled}
                        onPress={props.on.next}
                    >
                        {props.nextLabel}
                    </Button>
                </Cluster>
            </Stack>
        </SurfaceCard>
    </Stack>
)
