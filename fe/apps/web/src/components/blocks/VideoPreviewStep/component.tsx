import {
    HorizontalScrollRegion,
    Image,
    List,
    ListItem,
    MediaFrame,
    Progress,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import { VideoErrorAlert } from "@/components/leaves/VideoErrorAlert"
import { VideoStepFooter } from "@/components/leaves/VideoStepFooter"
import { PREVIEW_FRAME, PREVIEW_FRAME_WIDE, PREVIEW_STACK, PREVIEW_STRIP } from "./classNames"

/** The shape of the frames. */
export type VideoFrameShape = "portrait" | "square" | "landscape"

/** One scene of the storyboard. */
export interface VideoStoryFrame {
    readonly label: string
    readonly caption: string
    readonly mediaName: string | null
    readonly mediaUrl: string | null
    readonly mediaKind: "image" | "video" | null
}

/** Copy, state and handlers of the preview step. */
export interface VideoPreviewStepBaseProps {
    readonly props: {
        readonly heading: string
        readonly estimateLabel: string
        readonly hint: string
        readonly shape: VideoFrameShape
        readonly frames: ReadonlyArray<VideoStoryFrame>
        readonly live: boolean
        readonly progressTitle: string
        readonly stageLabel: string
        readonly progressLabel: string
        readonly progress: number
        readonly note: string
        readonly backLabel: string
        readonly renderLabel: string
        readonly pending: boolean
        readonly canRender: boolean
        readonly error: string | null
        readonly dismissLabel: string
    }
    readonly on: { readonly back: () => void; readonly render: () => void; readonly dismissError: () => void }
}

const previewOf = (frame: VideoStoryFrame, shape: VideoFrameShape) => {
    if (frame.mediaUrl === null || frame.mediaKind === null) {
        return (
            <MediaFrame aspect={shape}>
                <Text size="xs">{frame.caption}</Text>
            </MediaFrame>
        )
    }
    if (frame.mediaKind === "image") {
        return <Image src={frame.mediaUrl} alt={frame.mediaName ?? frame.label} aspect={shape} />
    }
    return (
        <MediaFrame aspect={shape}>
            <video
                src={`${frame.mediaUrl}#t=0.5`}
                preload="metadata"
                muted
                playsInline
                aria-label={frame.mediaName ?? frame.label}
            />
        </MediaFrame>
    )
}

/** Draws step four: the storyboard of the scenes, then the render with its progress. */
export const VideoPreviewStepBase = (props: VideoPreviewStepBaseProps) => (
    <div className={PREVIEW_STACK}>
        <SurfaceCard label={props.props.heading} fact={props.props.estimateLabel}>
            <div className={PREVIEW_STACK}>
                <Text size="xs" tone="muted">
                    {props.props.hint}
                </Text>
                <HorizontalScrollRegion overflow="needed" aria-label={props.props.heading}>
                    <List as="ol" className={PREVIEW_STRIP} label={props.props.heading}>
                        {props.props.frames.map((frame) => (
                            <ListItem
                                key={frame.label}
                                className={props.props.shape === "landscape" ? PREVIEW_FRAME_WIDE : PREVIEW_FRAME}
                            >
                                {previewOf(frame, props.props.shape)}
                                <Text as="span" size="xs" tone="muted">
                                    {frame.label}
                                </Text>
                            </ListItem>
                        ))}
                    </List>
                </HorizontalScrollRegion>
            </div>
        </SurfaceCard>
        <VideoErrorAlert
            message={props.props.error}
            dismissLabel={props.props.dismissLabel}
            onDismiss={props.on.dismissError}
        />
        {props.props.live ? (
            <SurfaceCard label={props.props.progressTitle} fact={props.props.stageLabel}>
                <Progress label={props.props.progressLabel} value={props.props.progress} />
            </SurfaceCard>
        ) : (
            <Text size="sm" tone="muted">
                {props.props.note}
            </Text>
        )}
        <VideoStepFooter
            backLabel={props.props.backLabel}
            nextLabel={props.props.renderLabel}
            pending={props.props.pending}
            nextDisabled={!props.props.canRender}
            onBack={props.on.back}
            onNext={props.on.render}
        />
    </div>
)
