import { useVideoScriptStepView } from "./useVideoScriptStepView"
import { useVideoPreviewStepView } from "./useVideoPreviewStepView"
import { useVideoResultStepView } from "./useVideoResultStepView"
import type { VideoViewInput, VideoResultBadge } from "./videoWorkbench.shared"
import type { EditorStep } from "@/modules/video"
import type { VideoScriptFormActions } from "./useVideoScriptStepView"
import type { VideoPreviewCardActions } from "./useVideoPreviewStepView"
import type { VideoResultViewActions } from "./useVideoResultStepView"
type UseVideoProductionViewsResult = {
    ui: {
        script: {
            heading: string
            writingLabel: string
            emptyLabel: string
            hasScenes: boolean
            writeLabel: string
            rewriteWarn: string | null
            scenes: {
                id: string
                title: string
                roleLabel: string
                roleTone: "success" | "accent" | "neutral"
                caption: string
                voiceover: string
                visualHint: string | null
                media: string
                canMoveUp: boolean
                canMoveDown: boolean
                canRemove: boolean
            }[]
            captionLabel: string
            voiceLabel: string
            mediaLabel: string
            moveUpLabel: string
            moveDownLabel: string
            removeLabel: string
            addLabel: string
            canAdd: boolean
            backLabel: string
            nextLabel: string
            estimateLabel: string | null
            saving: boolean
            canContinue: boolean
            dismissLabel: string
            error: string | null
        }
        preview:
            | {
                  heading: string
                  hint: string
                  progressTitle: string
                  progressLabel: string
                  note: string
                  backLabel: string
                  renderLabel: string
                  pending: boolean
                  error: string | null
                  dismissLabel: string
              }
            | {
                  heading: string
                  hint: string
                  progressTitle: string
                  progressLabel: string
                  note: string
                  backLabel: string
                  renderLabel: string
                  pending: boolean
                  error: string | null
                  dismissLabel: string
              }
        result: {
            failedTitle: string
            approveHeading: string
            approveHelp: string
            approving: boolean
            sharing: boolean
            posting: boolean
            lockedNote: string
            message: {
                readonly tone: "negative" | "informative"
                readonly text: string
            } | null
            heading: string
            waitingLabel: string
            captionsLabel: string
            approveLabel: string
            downloadLabel: string
            shareLabel: string
            postedLabel: string
            soonLabel: string
            tikTokLabel: string
            facebookLabel: string
            postNote: string
            editLabel: string
            rerenderLabel: string
        }
        scriptRequestPending: boolean
    }
    read: {
        script: {
            tookLabel: string | undefined
            mediaOptions: {
                id: string
                label: string
            }[]
            canEdit: boolean
            isScripting: boolean
            jobState: string | null
            projectFailure: string | null
        } | null
        preview: {
            estimateLabel: string
            shape: "portrait" | "square" | "landscape"
            frames: {
                label: string
                caption: string
                mediaName: string | null
                mediaUrl: string | null
                mediaKind: "video" | "image" | null
            }[]
            live: boolean
            stageLabel: string
            progress: number
            canRender: boolean
            hasRender: boolean
            statusFailure: string | null
        } | null
        result: {
            fact: string
            title: string
            shape: "portrait" | "square" | "landscape"
            videoUrl: string | null
            posterUrl: string | null
            captionsUrl: string | null
            captionsLang: string | null
            failedDetail: string | null
            badges: readonly VideoResultBadge[]
            showApprove: boolean
            approveDisabled: boolean
            downloadUrl: string | null
            showShare: boolean
            showPosted: boolean
            canEdit: boolean
            rerenderDisabled: boolean
            isApproved: boolean
            hasFailedRender: boolean
        } | null
    }
    on: {
        script: VideoScriptFormActions
        preview: VideoPreviewCardActions
        result: VideoResultViewActions
    }
    reads: any[]
}

/** Only the actual selected production step follows its durable status; other steps remain idle. */
export const useVideoProductionViews = (
    input: VideoViewInput,
    isEditor: boolean,
    step: EditorStep,
): UseVideoProductionViewsResult => {
    const ready = input.editor?.project !== null && input.editor !== null,
        script = useVideoScriptStepView({
            ...input,
            isActive: input.isActive && isEditor && step === "script" && ready,
        }),
        preview = useVideoPreviewStepView({
            ...input,
            isActive: input.isActive && isEditor && step === "preview" && ready,
        }),
        result = useVideoResultStepView({
            ...input,
            isActive: input.isActive && isEditor && step === "result" && ready,
        })
    const reads = [
        ...(script.isStatusEnabled ? [script.statusRead] : []),
        ...(preview.isStatusEnabled ? [preview.statusRead] : []),
    ]
    return {
        ui: {
            script: script.ui,
            preview: preview.ui,
            result: result.ui,
            scriptRequestPending: script.isRequestPending,
        },
        read: { script: script.read, preview: preview.read, result: result.read },
        on: { script: script.on, preview: preview.on, result: result.on },
        reads,
    }
}
