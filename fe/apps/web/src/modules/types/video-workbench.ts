import type { SlotPanelProps } from "./slot"
import type { WorkbenchDashboardRegions, WorkbenchExplanationView, WorkbenchFigureRegion } from "./workbench-dashboard"
import type { VideoEditorViews, VideoEditorActions } from "./video-editor-views"
import type { VideoLibraryViews, VideoLibraryActions } from "./video-library-views"
import type { VideoProductionViews, VideoProductionActions } from "./video-production-views"

type VideoGoalFormFields = VideoEditorViews["goal"]
type VideoGoalFormActions = VideoEditorActions["goal"]
type VideoInputsFormFields = VideoEditorViews["inputs"]
type VideoInputsFormActions = VideoEditorActions["inputs"]
type VideoScriptFormFields = VideoEditorViews["script"]
type VideoScriptFormActions = VideoEditorActions["script"]
type VideoEditStepsFields = VideoEditorViews["stepper"]
type VideoEditStepsActions = VideoEditorActions["stepper"]
type VideoBrandSettingsFields = VideoLibraryViews["brand"]
type VideoBrandSettingsActions = VideoLibraryActions["brand"]
type VideoLibraryListFields = VideoLibraryViews["library"]
type VideoLibraryListActions = VideoLibraryActions["library"]
type VideoPreviewCardFields = VideoProductionViews["preview"]
type VideoPreviewCardActions = VideoProductionActions["preview"]
type VideoResultViewFields = VideoProductionViews["result"]
type VideoResultViewActions = VideoProductionActions["result"]

/** The five project steps keep their existing URL and drawing order. */
export const VIDEO_EDITOR_STEPS = ["goal", "inputs", "script", "preview", "result"] as const
/** The original normal dashboard tabs. */
export const VIDEO_TABS = ["library", "brand"] as const
/** The two normal dashboard tabs retain their existing URL values. */
type VideoTab = (typeof VIDEO_TABS)[number]
/** Route identity selects the actual installation, focus editor and normal tab. */
interface VideoWorkbenchInput {
    readonly installationId: string | null
    readonly tab: string | null
    readonly focus: string | null
    readonly isEditor: boolean
    readonly tabs: Readonly<Record<VideoTab, string>>
}
type GoalUi = Omit<VideoGoalFormFields, "disabled">
type InputsUi = Omit<VideoInputsFormFields, "sources" | "media" | "canEdit">
type BrandUi = Omit<VideoBrandSettingsFields, "logoUrl" | "canEdit">
type StepperUi = Omit<VideoEditStepsFields, "steps" | "current" | "viewOnly"> & {
    readonly steps: ReadonlyArray<{ readonly id: string; readonly label: string }>
}
type ScriptUi = Omit<VideoScriptFormFields, "tookLabel" | "writing" | "mediaOptions" | "canEdit" | "locked">
type PreviewUi = Pick<
    VideoPreviewCardFields,
    | "heading"
    | "hint"
    | "progressTitle"
    | "progressLabel"
    | "note"
    | "backLabel"
    | "dismissLabel"
    | "pending"
    | "error"
    | "renderLabel"
>
type ResultUi = Pick<
    VideoResultViewFields,
    | "heading"
    | "captionsLabel"
    | "waitingLabel"
    | "approveLabel"
    | "downloadLabel"
    | "shareLabel"
    | "postedLabel"
    | "soonLabel"
    | "tikTokLabel"
    | "facebookLabel"
    | "postNote"
    | "editLabel"
    | "rerenderLabel"
    | "approving"
    | "sharing"
    | "posting"
    | "message"
    | "approveHeading"
    | "approveHelp"
    | "lockedNote"
    | "failedTitle"
>
type LibraryUi = Omit<VideoLibraryListFields, "meta" | "entries" | "canEdit" | "viewOnly">
/** Known words and actual local drafts/operations remain outside the read slots. */
interface VideoWorkbenchUiFields {
    readonly stepper: StepperUi
    readonly goal: GoalUi
    readonly inputs: InputsUi
    readonly brand: BrandUi
    readonly script: ScriptUi
    readonly preview: PreviewUi
    readonly result: ResultUi
    readonly library: LibraryUi
    readonly mediaPaths: ReadonlyArray<string>
    readonly scriptRequestPending: boolean
    readonly mediaNoneLabel: string
    readonly rerenderLabel: string
    readonly approvedHeadingLabel: string
    readonly viewOnlyLabel: string
    readonly createLabel: string
    readonly createHref: string
}
/** Only genuine joined editor facts enter this slot; absent project-only panels stay null. */
interface VideoEditorPanelFields {
    readonly stepper: { readonly current: string; readonly hasProject: boolean; readonly isViewOnly: boolean }
    readonly goal: Pick<VideoGoalFormFields, "disabled">
    readonly inputs: {
        readonly sources: VideoInputsFormFields["sources"]
        readonly media: ReadonlyArray<{
            readonly path: string
            readonly name: string
            readonly kind: "image" | "video"
            readonly url: string | null
        }>
        readonly canEdit: boolean
    }
    readonly brand: Pick<VideoBrandSettingsFields, "logoUrl" | "canEdit">
    readonly script:
        | (Pick<VideoScriptFormFields, "tookLabel" | "canEdit" | "mediaOptions"> & {
              readonly isScripting: boolean
              readonly jobState: string | null
              readonly projectFailure: string | null
          })
        | null
    readonly preview:
        | (Omit<VideoPreviewCardFields, keyof PreviewUi> & {
              readonly hasRender: boolean
              readonly statusFailure: string | null
          })
        | null
    readonly result:
        | (Omit<VideoResultViewFields, keyof ResultUi> & {
              readonly isApproved: boolean
              readonly hasFailedRender: boolean
          })
        | null
}
/** Normal read facts contain real video rows, media lookup and permission, without form or copy snapshots. */
interface VideoNormalPanelFields {
    readonly library: Pick<VideoLibraryListFields, "meta" | "entries" | "canEdit"> & { readonly isViewOnly: boolean }
    readonly brand: Pick<VideoBrandSettingsFields, "logoUrl" | "canEdit">
    readonly canCreate: boolean
}
/** Independent read slots stay separate from resolved words and actual local form state. */
interface VideoWorkbenchFields {
    readonly ui: VideoWorkbenchUiFields
    readonly loadFailedBody: string
    readonly why: WorkbenchExplanationView
    readonly regions: WorkbenchDashboardRegions
    readonly ribbon: WorkbenchFigureRegion
    readonly normal: Pick<SlotPanelProps<VideoNormalPanelFields>, "slot" | "labels">
    readonly editor: Pick<SlotPanelProps<VideoEditorPanelFields>, "slot" | "labels">
    readonly tabsLabel: string
    readonly selectedTab: VideoTab
    readonly tabs: ReadonlyArray<{ readonly id: VideoTab; readonly label: string }>
}
/** Each existing command and retry remains owned by its original Video controller. */
export interface VideoWorkbenchActions {
    readonly selectTab: (id: string) => void
    readonly closeWhy: () => void
    readonly retryDashboard: () => void
    readonly retryEditor: () => void
    readonly retryNormal: () => void
    readonly retryFigures: () => void
    readonly stepper: VideoEditStepsActions
    readonly goal: VideoGoalFormActions
    readonly inputs: VideoInputsFormActions
    readonly brand: VideoBrandSettingsActions
    readonly script: VideoScriptFormActions
    readonly preview: VideoPreviewCardActions
    readonly result: VideoResultViewActions
    readonly library: VideoLibraryListActions
}
/** The eight approved normal, editor and explanation drawings. */
type VideoWorkbenchShape = VideoTab | (typeof VIDEO_EDITOR_STEPS)[number] | "explanation"
/** The connected owner resolves atoms and commands for one pure workbench drawing. */
interface VideoWorkbenchView {
    readonly shape: VideoWorkbenchShape
    readonly props: VideoWorkbenchFields
    readonly on: VideoWorkbenchActions
}

/** The workbench input, read regions and resolved drawing assembly. */
export interface VideoWorkbenchViews {
    readonly tab: VideoTab
    readonly editorStep: (typeof VIDEO_EDITOR_STEPS)[number]
    readonly input: VideoWorkbenchInput
    readonly editorPanel: VideoEditorPanelFields
    readonly normalPanel: VideoNormalPanelFields
    readonly fields: VideoWorkbenchFields
    readonly shape: VideoWorkbenchShape
    readonly view: VideoWorkbenchView
}
