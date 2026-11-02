/** The approved frame aspect ratios shared by preview and published output. */
type VideoFrameShape = "portrait" | "square" | "landscape"

/** One actual story frame preserves its resolved media link and caption. */
interface VideoStoryFrame {
    readonly label: string
    readonly caption: string
    readonly mediaName: string | null
    readonly mediaUrl: string | null
    readonly mediaKind: "image" | "video" | null
}

/** Resolved preview words and actual render facts drawn by the native card. */
interface VideoPreviewCardFields {
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

/** Preview navigation and render commands remain atomic events. */
interface VideoPreviewCardActions {
    readonly back: () => void
    readonly render: () => void
    readonly dismissError: () => void
}

/** One resolved publication badge preserves its original neutral or successful meaning. */
interface VideoResultBadge {
    readonly id: string
    readonly tone: "neutral" | "success"
    readonly text: string
}

/** Published output facts, local operation state and resolved result copy drawn together. */
interface VideoResultViewFields {
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

/** The result drawing exposes only its existing publication and navigation commands. */
interface VideoResultViewActions {
    readonly approve: () => void
    readonly share: () => void
    readonly posted: () => void
    readonly edit: () => void
    readonly rerender: () => void
}

/** Resolved preview and result drawing fields. */
export interface VideoProductionViews {
    readonly frameShape: VideoFrameShape
    readonly storyFrame: VideoStoryFrame
    readonly resultBadge: VideoResultBadge
    readonly preview: VideoPreviewCardFields
    readonly result: VideoResultViewFields
}

/** Commands initiated by preview and result drawings. */
export interface VideoProductionActions {
    readonly preview: VideoPreviewCardActions
    readonly result: VideoResultViewActions
}
