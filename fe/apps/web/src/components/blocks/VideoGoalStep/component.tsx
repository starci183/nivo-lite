import { Button, Input, RadioGroup, SegmentedControl, SurfaceCard } from "@starci/grammar/common"
import { VideoErrorAlert } from "@/components/leaves/VideoErrorAlert"
import { GOAL_FOOTER, GOAL_STACK } from "./classNames"

/** One choice of a group. */
export interface VideoGoalOption {
    readonly value: string
    readonly label: string
    readonly description?: string
}

/** Copy, state and handlers of the goal step. */
export interface VideoGoalStepBaseProps {
    readonly props: {
        readonly heading: string
        readonly goals: ReadonlyArray<VideoGoalOption>
        readonly goal: string
        readonly aspectLabel: string
        readonly aspects: ReadonlyArray<VideoGoalOption>
        readonly aspect: string
        readonly durationLabel: string
        readonly durations: ReadonlyArray<VideoGoalOption>
        readonly seconds: string
        readonly titleLabel: string
        readonly titleHint: string
        readonly title: string
        readonly nextLabel: string
        readonly disabled: boolean
        readonly pending: boolean
        readonly error: string | null
        readonly dismissLabel: string
    }
    readonly on: {
        readonly goal: (value: string) => void
        readonly aspect: (value: string) => void
        readonly seconds: (value: string) => void
        readonly title: (value: string) => void
        readonly next: () => void
        readonly dismissError: () => void
    }
}

/** Draws step one: what the video is for, its frame, its length and its working title. */
export const VideoGoalStepBase = (props: VideoGoalStepBaseProps) => (
    <div className={GOAL_STACK}>
        <VideoErrorAlert
            message={props.props.error}
            dismissLabel={props.props.dismissLabel}
            onDismiss={props.on.dismissError}
        />
        <SurfaceCard label={props.props.heading}>
            <div className={GOAL_STACK}>
                <RadioGroup
                    label={props.props.heading}
                    isLabelHidden
                    value={props.props.goal}
                    isDisabled={props.props.disabled}
                    options={props.props.goals}
                    onValueChange={props.on.goal}
                />
                <SegmentedControl
                    label={props.props.aspectLabel}
                    value={props.props.aspect}
                    isDisabled={props.props.disabled}
                    options={props.props.aspects}
                    onValueChange={props.on.aspect}
                />
                <SegmentedControl
                    label={props.props.durationLabel}
                    value={props.props.seconds}
                    isDisabled={props.props.disabled}
                    options={props.props.durations}
                    onValueChange={props.on.seconds}
                />
                <Input
                    id="video-title"
                    name="title"
                    label={props.props.titleLabel}
                    hint={props.props.titleHint}
                    value={props.props.title}
                    isDisabled={props.props.disabled}
                    onValueChange={props.on.title}
                />
                <div className={GOAL_FOOTER}>
                    <Button
                        intent="commit"
                        isPending={props.props.pending}
                        isDisabled={props.props.disabled}
                        onPress={props.on.next}
                    >
                        {props.props.nextLabel}
                    </Button>
                </div>
            </div>
        </SurfaceCard>
    </div>
)
