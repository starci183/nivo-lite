import { type ScriptScene, estimateScriptSeconds, VIDEO_MAX_SECONDS, SCRIPT_MAX_SCENES } from "@/modules/video"
import { useTranslations, useFormatter } from "next-intl"
import type { useVideoScriptForm } from "@/hooks/rhf"
import { useVideoFailure, type useVideoScript } from "@/hooks/video"
import type { VideoViewInput } from "./videoWorkbench.shared"

interface ScriptProjection {
    readonly input: VideoViewInput
    readonly form: ReturnType<typeof useVideoScriptForm>
    readonly job: ReturnType<typeof useVideoScript>
    readonly error: string | null
    readonly pending: boolean
}
const ROLE_TONE = { hook: "accent", body: "neutral", cta: "success" } as const
/** Actual scene edit identities and localized presentation, resolved above the lower drawing. */
const sceneCardsOf = (scenes: ReadonlyArray<ScriptScene>, t: ReturnType<typeof useTranslations<"video">>) =>
    scenes.map((scene, index) => ({
        id: scene.id,
        title: t("sceneN", { n: index + 1 }),
        roleLabel: t(`role_${scene.role}`),
        roleTone: ROLE_TONE[scene.role],
        caption: scene.caption,
        voiceover: scene.voiceover,
        visualHint: scene.visual === "" ? null : t("visualHint", { text: scene.visual }),
        media: scene.media ?? "none",
        canMoveUp: index > 0,
        canMoveDown: index < scenes.length - 1,
        canRemove: scenes.length > 1,
    }))
/** Whether the script has no scene yet, runs past the longest video or fits. */
const estimateStateOf = (sceneCount: number, total: number): "none" | "long" | "ok" => {
    if (sceneCount === 0) return "none"
    return total > VIDEO_MAX_SECONDS ? "long" : "ok"
}
type VideoScriptFieldsOfResult = {
    ui: {
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
    read: {
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
}

/** The script form's exact labels, estimate and command failures. */
export const useVideoScriptFields = (context: ScriptProjection): VideoScriptFieldsOfResult => {
    const { input, form, job, error, pending } = context,
        t = useTranslations("video"),
        format = useFormatter(),
        failure = useVideoFailure(),
        project = input.editor?.project ?? null,
        copy = input.copy,
        scenes = form.watch("scenes"),
        dirty = form.formState.isDirty,
        total = estimateScriptSeconds(scenes),
        estimate = estimateStateOf(scenes.length, total),
        estimateKey = estimate === "long" ? "tooLong" : "estimated",
        estimateLabel = estimate === "none" ? null : t(estimateKey, { n: total })
    return {
        ui: {
            heading: copy.scriptHeading,
            writingLabel: copy.scripting,
            emptyLabel: copy.scriptEmpty,
            hasScenes: scenes.length > 0,
            writeLabel: scenes.length > 0 ? copy.rewriteScript : copy.writeScript,
            rewriteWarn: scenes.length > 0 && dirty ? copy.rewriteWarn : null,
            scenes: sceneCardsOf(scenes, t),
            captionLabel: copy.captionLabel,
            voiceLabel: copy.voiceLabel,
            mediaLabel: copy.mediaPick,
            moveUpLabel: copy.moveUp,
            moveDownLabel: copy.moveDown,
            removeLabel: copy.removeScene,
            addLabel: copy.addScene,
            canAdd: scenes.length < SCRIPT_MAX_SCENES,
            backLabel: copy.back,
            nextLabel: copy.next,
            estimateLabel,
            saving: form.formState.isSubmitting || pending,
            canContinue: estimate === "ok",
            dismissLabel: copy.back,
            error: error ?? (Object.keys(form.formState.errors).length > 0 ? copy.err_default : null),
        },
        read:
            project === null || input.editor === null
                ? null
                : {
                      tookLabel:
                          project.scriptMs === null
                              ? undefined
                              : t("scriptTook", {
                                    s: format.number(project.scriptMs / 1000, { maximumFractionDigits: 0 }),
                                }),
                      mediaOptions: input.editor.media.map((item) => ({ id: item.path, label: item.name })),
                      canEdit: input.editor.canEdit,
                      isScripting: project.status === "scripting",
                      jobState: job.status?.status ?? null,
                      projectFailure: project.lastError ? failure(project.lastError) : null,
                  },
    }
}
