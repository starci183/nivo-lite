import type { VideoProductionActions, VideoProductionViews, VideoWorkbenchViews } from "@/modules/types"
type VideoEditorPanelFields = VideoWorkbenchViews["editorPanel"]
type VideoResultViewFields = VideoProductionViews["result"]
type VideoResultViewActions = VideoProductionActions["result"]

/** Native output geometry before its actual result read, without a fabricated publication. */
export const VIDEO_RESULT_VIEW_READ_DEFAULTS: NonNullable<VideoEditorPanelFields["result"]> = {
    fact: "",
    title: "",
    shape: "portrait",
    videoUrl: null,
    posterUrl: null,
    captionsUrl: null,
    captionsLang: null,
    failedDetail: null,
    badges: [],
    showApprove: true,
    approveDisabled: true,
    downloadUrl: null,
    showShare: false,
    showPosted: false,
    canEdit: false,
    rerenderDisabled: true,
    isApproved: false,
    hasFailedRender: false,
}

interface VideoResultViewProps extends VideoResultViewFields {
    readonly isLoading: boolean
    readonly on: VideoResultViewActions
}
import { Alert, Badge, Button, MediaFrame, SurfaceCard, Text, Video, Stack, Cluster } from "@starci/grammar/common"

const playerOf = (props: VideoResultViewProps) => {
    if (props.videoUrl !== null) {
        return (
            <MediaFrame
                aspect={props.shape}
                fit="contain"
                media={
                    <Video
                        title={props.title}
                        {...(props.posterUrl === null ? {} : { poster: props.posterUrl })}
                        src={props.videoUrl}
                        captions={
                            props.captionsUrl === null
                                ? null
                                : {
                                      src: props.captionsUrl,
                                      label: props.captionsLabel,
                                      ...(props.captionsLang === null ? {} : { srcLang: props.captionsLang }),
                                  }
                        }
                        {...(props.captionsUrl === null ? {} : { crossOrigin: "anonymous" as const })}
                    />
                }
            />
        )
    }
    if (props.failedTitle !== null) {
        return <Alert tone="negative" title={props.failedTitle} description={props.failedDetail ?? undefined} />
    }
    return (
        <Text isLoading={props.isLoading} size="sm" tone="muted">
            {props.waitingLabel}
        </Text>
    )
}

const approvalOf = (props: VideoResultViewProps) => {
    return (
        <SurfaceCard isLoading={props.isLoading} label={props.approveHeading}>
            <Stack gap="section">
                {props.approveHelp === null ? null : (
                    <Text isLoading={props.isLoading} size="sm" tone="muted">
                        {props.approveHelp}
                    </Text>
                )}
                <Cluster gap="inline">
                    {props.showApprove ? (
                        <Button
                            isLoading={props.isLoading}
                            intent="commit"
                            isPending={props.approving}
                            isDisabled={props.approveDisabled}
                            onPress={props.on.approve}
                        >
                            {props.approveLabel}
                        </Button>
                    ) : null}
                    {props.downloadUrl === null ? null : (
                        <Button isLoading={props.isLoading} intent="alternative" href={props.downloadUrl} download>
                            {props.downloadLabel}
                        </Button>
                    )}
                    {props.showShare ? (
                        <Button
                            isLoading={props.isLoading}
                            intent="alternative"
                            isPending={props.sharing}
                            isDisabled={!props.canEdit}
                            onPress={props.on.share}
                        >
                            {props.shareLabel}
                        </Button>
                    ) : null}
                    {props.showPosted ? (
                        <Button
                            isLoading={props.isLoading}
                            intent="neutral"
                            isPending={props.posting}
                            isDisabled={!props.canEdit}
                            onPress={props.on.posted}
                        >
                            {props.postedLabel}
                        </Button>
                    ) : null}
                </Cluster>
                <div aria-label={props.soonLabel}>
                    <Cluster gap="inline">
                        <Button
                            isLoading={props.isLoading}
                            intent="neutral"
                            isDisabled
                            endContent={<Badge tone="warning">{props.soonLabel}</Badge>}
                        >
                            {props.tikTokLabel}
                        </Button>
                        <Button
                            isLoading={props.isLoading}
                            intent="neutral"
                            isDisabled
                            endContent={<Badge tone="warning">{props.soonLabel}</Badge>}
                        >
                            {props.facebookLabel}
                        </Button>
                    </Cluster>
                </div>
                <Text isLoading={props.isLoading} size="xs" tone="muted">
                    {props.postNote}
                </Text>
            </Stack>
        </SurfaceCard>
    )
}

/** Draws step five: the player, the approval, download, share and the owner's own posting. */
export const VideoResultView = (props: VideoResultViewProps) => (
    <Stack gap="section">
        {props.message === null ? null : <Alert tone={props.message.tone} title={props.message.text} />}
        <SurfaceCard isLoading={props.isLoading} label={props.heading} fact={props.fact}>
            <Stack gap="section">
                {playerOf(props)}
                <Cluster gap="inline">
                    {props.badges.map((badge) => (
                        <Badge key={badge.id} tone={badge.tone}>
                            {badge.text}
                        </Badge>
                    ))}
                </Cluster>
            </Stack>
        </SurfaceCard>

        {approvalOf(props)}
        <Cluster gap="inline" justify="between" align="start">
            <Stack gap="identity">
                <Button
                    isLoading={props.isLoading}
                    intent="neutral"
                    isDisabled={!props.canEdit}
                    onPress={props.on.edit}
                >
                    {props.editLabel}
                </Button>
                {props.lockedNote === null ? null : (
                    <Text isLoading={props.isLoading} size="xs" tone="muted">
                        {props.lockedNote}
                    </Text>
                )}
            </Stack>
            <Button
                isLoading={props.isLoading}
                intent="neutral"
                isDisabled={props.rerenderDisabled}
                onPress={props.on.rerender}
            >
                {props.rerenderLabel}
            </Button>
        </Cluster>
    </Stack>
)
