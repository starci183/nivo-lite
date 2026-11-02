import type { VideoProductionActions, VideoProductionViews, VideoWorkbenchViews } from "@/modules/types"
type VideoEditorPanelFields = VideoWorkbenchViews["editorPanel"]
type VideoFrameShape = VideoProductionViews["frameShape"]
type VideoStoryFrame = VideoProductionViews["storyFrame"]
type VideoPreviewCardFields = VideoProductionViews["preview"]
type VideoPreviewCardActions = VideoProductionActions["preview"]

/** Native preview geometry before its actual project read, without invented story frames. */
export const VIDEO_PREVIEW_CARD_READ_DEFAULTS: NonNullable<VideoEditorPanelFields["preview"]> = {
    estimateLabel: "",
    shape: "portrait",
    frames: [],
    live: false,
    stageLabel: "",
    progress: 0,
    canRender: false,
    hasRender: false,
    statusFailure: null,
}

interface VideoPreviewCardProps extends VideoPreviewCardFields {
    readonly isLoading: boolean
    readonly on: VideoPreviewCardActions
}
import {
    HorizontalScrollRegion,
    Cluster,
    Image,
    MediaFrame,
    Progress,
    SurfaceCard,
    Text,
    Stack,
} from "@starci/grammar/common"
import { VideoErrorAlert } from "@/components/leaves/VideoErrorAlert"
import { VideoStepFooter } from "@/components/leaves/VideoStepFooter"
import { PREVIEW_FRAME, PREVIEW_FRAME_WIDE } from "./classNames"

const previewOf = (frame: VideoStoryFrame, shape: VideoFrameShape, isLoading: boolean) => {
    if (frame.mediaUrl === null || frame.mediaKind === null) {
        return (
            <MediaFrame
                aspect={shape}
                media={
                    <Text isLoading={isLoading} size="xs">
                        {frame.caption}
                    </Text>
                }
            />
        )
    }
    if (frame.mediaKind === "image") {
        return <Image src={frame.mediaUrl} alt={frame.mediaName ?? frame.label} aspect={shape} />
    }
    return (
        <MediaFrame
            aspect={shape}
            media={
                <video
                    src={`${frame.mediaUrl}#t=0.5`}
                    preload="metadata"
                    muted
                    playsInline
                    aria-label={frame.mediaName ?? frame.label}
                />
            }
        />
    )
}

/** Draws step four: the storyboard of the scenes, then the render with its progress. */
export const VideoPreviewCard = (props: VideoPreviewCardProps) => (
    <Stack gap="section">
        <SurfaceCard isLoading={props.isLoading} label={props.heading} fact={props.estimateLabel}>
            <Stack gap="section">
                <Text isLoading={props.isLoading} size="xs" tone="muted">
                    {props.hint}
                </Text>
                <HorizontalScrollRegion overflow="needed" aria-label={props.heading}>
                    <Cluster gap="row" align="start" wrap={false}>
                        {props.frames.map((frame) => (
                            <div
                                key={frame.label}
                                className={props.shape === "landscape" ? PREVIEW_FRAME_WIDE : PREVIEW_FRAME}
                            >
                                <Stack gap="identity">
                                    {previewOf(frame, props.shape, props.isLoading)}
                                    <Text isLoading={props.isLoading} as="span" size="xs" tone="muted">
                                        {frame.label}
                                    </Text>
                                </Stack>
                            </div>
                        ))}
                    </Cluster>
                </HorizontalScrollRegion>
            </Stack>
        </SurfaceCard>
        <VideoErrorAlert message={props.error} dismissLabel={props.dismissLabel} onDismiss={props.on.dismissError} />
        {props.live ? (
            <SurfaceCard isLoading={props.isLoading} label={props.progressTitle} fact={props.stageLabel}>
                <Progress isLoading={props.isLoading} label={props.progressLabel} value={props.progress} />
            </SurfaceCard>
        ) : (
            <Text isLoading={props.isLoading} size="sm" tone="muted">
                {props.note}
            </Text>
        )}
        <VideoStepFooter
            isLoading={props.isLoading}
            backLabel={props.backLabel}
            nextLabel={props.renderLabel}
            pending={props.pending}
            nextDisabled={!props.canRender}
            onBack={props.on.back}
            onNext={props.on.render}
        />
    </Stack>
)
