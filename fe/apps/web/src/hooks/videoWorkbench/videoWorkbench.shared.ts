import type { VideoProductionViews } from "@/modules/types"
type VideoResultBadge = VideoProductionViews["resultBadge"]

import type { VideoEditorData, Brand, MediaItem, ProjectView, VideoWorkbenchCopy, ScriptScene } from "@/modules/video"
import type { useTranslations, useFormatter } from "next-intl"
import type { useVideoScriptForm } from "@/hooks/rhf"
import type { useVideoScript, useVideoFailure } from "@/hooks/video"
import { estimateScriptSeconds, VIDEO_MAX_SECONDS, SCRIPT_MAX_SCENES } from "@/modules/video"
/** Real tenant/instance and selected surface, not synthetic query state. */
export interface VideoViewInput {
    readonly editor: VideoEditorData | null
    readonly library: {
        readonly brand: Brand
        readonly media: ReadonlyArray<MediaItem>
        readonly projects: ReadonlyArray<ProjectView>
        readonly canEdit: boolean
    } | null
    readonly copy: VideoWorkbenchCopy
    readonly isActive: boolean
    readonly scope: string
}
/** The picture shape an aspect ratio is drawn in: portrait, square or landscape. */
export const shapeOf = (aspect: string): "portrait" | "square" | "landscape" => {
    if (aspect === "9:16") return "portrait"
    return aspect === "1:1" ? "square" : "landscape"
}
/** Commands and reads share the actual tenant/instance scope plus their existing region identity. */
export const videoOwnerOf = (input: VideoViewInput, region: string) => ({
    isActive: input.isActive,
    scope: JSON.stringify([input.scope, region]),
})
interface ScriptProjection {
    readonly input: VideoViewInput
    readonly form: ReturnType<typeof useVideoScriptForm>
    readonly job: ReturnType<typeof useVideoScript>
    readonly error: string | null
    readonly pending: boolean
    readonly t: ReturnType<typeof useTranslations<"video">>
    readonly format: ReturnType<typeof useFormatter>
    readonly failure: ReturnType<typeof useVideoFailure>
}
const ROLE_TONE = { hook: "accent", body: "neutral", cta: "success" } as const
/** Actual scene edit identities and localized presentation, resolved above the lower drawing. */
const sceneCardsOf = (scenes: ReadonlyArray<ScriptScene>, t: ScriptProjection["t"]) =>
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
/** The script form's exact labels, estimate and command failures. */
export const videoScriptFieldsOf = (context: ScriptProjection) => {
    const { input, form, job, error, pending, t, format, failure } = context,
        project = input.editor?.project ?? null,
        copy = input.copy,
        scenes = form.watch("scenes"),
        dirty = form.formState.isDirty,
        total = estimateScriptSeconds(scenes),
        estimate = estimateStateOf(scenes.length, total)
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
            estimateLabel: estimate === "none" ? null : t(estimate === "long" ? "tooLong" : "estimated", { n: total }),
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
/** Reorders only existing scene positions, retaining every identity. */
export const swapped = <T>(scenes: ReadonlyArray<T>, index: number, target: number): ReadonlyArray<T> => {
    const from = scenes[index],
        to = scenes[target]
    if (from === undefined || to === undefined) return scenes
    return scenes.map((scene, at) => {
        if (at === index) return to
        return at === target ? from : scene
    })
}

/** Publication facts retain their actual length, size, aspect and approval provenance. */
export const videoResultBadgesOf = (
    project: ProjectView,
    t: ReturnType<typeof useTranslations<"video">>,
    format: ReturnType<typeof useFormatter>,
): ReadonlyArray<VideoResultBadge> => {
    const render = project.render
    const approved = project.status === "approved" || project.status === "published"
    return [
        ...(render?.durationMs
            ? [
                  {
                      id: "length",
                      tone: "neutral" as const,
                      text: t("seconds", { n: Math.round(render.durationMs / 1000) }),
                  },
              ]
            : []),
        ...(render?.sizeBytes
            ? [
                  {
                      id: "size",
                      tone: "neutral" as const,
                      text: t("fileSize", {
                          n: format.number(render.sizeBytes / 1_048_576, { maximumFractionDigits: 1 }),
                      }),
                  },
              ]
            : []),
        { id: "aspect", tone: "neutral" as const, text: project.aspect },
        ...(approved
            ? [
                  {
                      id: "approved",
                      tone: "success" as const,
                      text:
                          project.approvedByName === null
                              ? t(`status_${project.status}`)
                              : t("approvedBy", { name: project.approvedByName }),
                  },
              ]
            : []),
    ]
}
