import { Alert, Badge, Button, MediaFrame, SurfaceCard, Text, Video } from "@starci/grammar/common"
import { RESULT_COPY, RESULT_FOOTER, RESULT_ROW, RESULT_STACK } from "./classNames"

/** One badge under the player. */
export interface VideoResultBadge {
    readonly id: string
    readonly tone: "neutral" | "success"
    readonly text: string
}

/** Copy, state and handlers of the result step. */
export interface VideoResultStepBaseProps {
    readonly props: {
        readonly heading: string
        readonly fact: string
        readonly title: string
        readonly shape: "portrait" | "square" | "landscape"
        readonly videoUrl: string | null
        readonly posterUrl: string | null
        readonly captionsUrl: string | null
        readonly captionsLang: string | null
        readonly captionsLabel: string
        readonly failedTitle: string | null
        readonly failedDetail: string | null
        readonly waitingLabel: string
        readonly badges: ReadonlyArray<VideoResultBadge>
        readonly approveHeading: string
        readonly approveHelp: string | null
        readonly approveLabel: string
        readonly showApprove: boolean
        readonly approving: boolean
        readonly approveDisabled: boolean
        readonly downloadLabel: string
        readonly downloadUrl: string | null
        readonly shareLabel: string
        readonly showShare: boolean
        readonly sharing: boolean
        readonly postedLabel: string
        readonly showPosted: boolean
        readonly posting: boolean
        readonly soonLabel: string
        readonly tikTokLabel: string
        readonly facebookLabel: string
        readonly postNote: string
        readonly editLabel: string
        readonly lockedNote: string | null
        readonly rerenderLabel: string
        readonly canEdit: boolean
        readonly rerenderDisabled: boolean
        readonly message: { readonly tone: "negative" | "informative"; readonly text: string } | null
    }
    readonly on: {
        readonly approve: () => void
        readonly share: () => void
        readonly posted: () => void
        readonly edit: () => void
        readonly rerender: () => void
    }
}

const playerOf = (props: VideoResultStepBaseProps["props"]) => {
    if (props.videoUrl !== null) {
        return (
            <MediaFrame aspect={props.shape} fit="contain">
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
            </MediaFrame>
        )
    }
    if (props.failedTitle !== null) {
        return <Alert tone="negative" title={props.failedTitle} description={props.failedDetail ?? undefined} />
    }
    return (
        <Text size="sm" tone="muted">
            {props.waitingLabel}
        </Text>
    )
}

const approvalOf = (props: VideoResultStepBaseProps) => {
    return (
        <SurfaceCard label={props.props.approveHeading}>
            <div className={RESULT_STACK}>
                {props.props.approveHelp === null ? null : (
                    <Text size="sm" tone="muted">
                        {props.props.approveHelp}
                    </Text>
                )}
                <div className={RESULT_ROW}>
                    {props.props.showApprove ? (
                        <Button
                            intent="commit"
                            isPending={props.props.approving}
                            isDisabled={props.props.approveDisabled}
                            onPress={props.on.approve}
                        >
                            {props.props.approveLabel}
                        </Button>
                    ) : null}
                    {props.props.downloadUrl === null ? null : (
                        <Button intent="alternative" href={props.props.downloadUrl} download>
                            {props.props.downloadLabel}
                        </Button>
                    )}
                    {props.props.showShare ? (
                        <Button
                            intent="alternative"
                            isPending={props.props.sharing}
                            isDisabled={!props.props.canEdit}
                            onPress={props.on.share}
                        >
                            {props.props.shareLabel}
                        </Button>
                    ) : null}
                    {props.props.showPosted ? (
                        <Button
                            intent="neutral"
                            isPending={props.props.posting}
                            isDisabled={!props.props.canEdit}
                            onPress={props.on.posted}
                        >
                            {props.props.postedLabel}
                        </Button>
                    ) : null}
                </div>
                <div className={RESULT_ROW} aria-label={props.props.soonLabel}>
                    <Button
                        intent="neutral"
                        isDisabled
                        endContent={<Badge tone="warning">{props.props.soonLabel}</Badge>}
                    >
                        {props.props.tikTokLabel}
                    </Button>
                    <Button
                        intent="neutral"
                        isDisabled
                        endContent={<Badge tone="warning">{props.props.soonLabel}</Badge>}
                    >
                        {props.props.facebookLabel}
                    </Button>
                </div>
                <Text size="xs" tone="muted">
                    {props.props.postNote}
                </Text>
            </div>
        </SurfaceCard>
    )
}

/** Draws step five: the player, the approval, download, share and the owner's own posting. */
export const VideoResultStepBase = (props: VideoResultStepBaseProps) => (
    <div className={RESULT_STACK}>
        {props.props.message === null ? null : (
            <Alert tone={props.props.message.tone} title={props.props.message.text} />
        )}
        <SurfaceCard label={props.props.heading} fact={props.props.fact}>
            <div className={RESULT_STACK}>
                {playerOf(props.props)}
                <div className={RESULT_ROW}>
                    {props.props.badges.map((badge) => (
                        <Badge key={badge.id} tone={badge.tone}>
                            {badge.text}
                        </Badge>
                    ))}
                </div>
            </div>
        </SurfaceCard>

        {approvalOf(props)}
        <div className={RESULT_FOOTER}>
            <div className={RESULT_COPY}>
                <Button intent="neutral" isDisabled={!props.props.canEdit} onPress={props.on.edit}>
                    {props.props.editLabel}
                </Button>
                {props.props.lockedNote === null ? null : (
                    <Text size="xs" tone="muted">
                        {props.props.lockedNote}
                    </Text>
                )}
            </div>
            <Button intent="neutral" isDisabled={props.props.rerenderDisabled} onPress={props.on.rerender}>
                {props.props.rerenderLabel}
            </Button>
        </div>
    </div>
)
