import type { VideoBrandType, VideoMediaType, VideoProjectType } from "@/hooks/swr"
import { ASPECTS, isGoal, Brand, MediaItem, ProjectStatus, ProjectView, SceneRole } from "@/modules/video"
import type { RenderView } from "@/modules/video"

export {
    aspectKey,
    ASPECTS,
    DURATIONS,
    editorHref,
    estimateScriptSeconds,
    GOAL_TEMPLATES,
    goalHintKey,
    goalLabelKey,
    goalTemplateOf,
    isUuid,
    MUSIC_TRACKS,
    newScene,
    SCRIPT_MAX_SCENES,
    stepFor,
    TTS_VOICES,
    VIDEO_MAX_SECONDS,
} from "@/modules/video"
export type {
    Aspect,
    Brand,
    EditorStep,
    Goal,
    MediaItem,
    ProjectInputs,
    ProjectStatus,
    ProjectView,
    SceneRole,
    ScriptScene,
    SourceChoice,
} from "@/modules/video"

const STATUSES: ReadonlyArray<ProjectStatus> = [
    "draft",
    "scripting",
    "rendering",
    "ready",
    "approved",
    "published",
    "archived",
]
const ROLES: ReadonlyArray<SceneRole> = ["hook", "body", "cta"]

/** The editor's render states the generated render status maps to. */
const RENDER_STATUS: ReadonlyMap<string, RenderView["status"]> = new Map([
    ["done", "done"],
    ["succeeded", "done"],
    ["failed", "failed"],
    ["queued", "queued"],
])

const renderStatusOf = (status: string | null | undefined): RenderView["status"] =>
    RENDER_STATUS.get(status ?? "") ?? "rendering"

/** Adapts the generated project payload to the editor's view model. */
export const projectViewOf = (project: VideoProjectType): ProjectView => {
    const render = project.render
    const renderStatus = renderStatusOf(render?.status)
    return {
        ...project,
        goal: isGoal(project.goal) ? project.goal : "service",
        aspect: ASPECTS.find((aspect) => aspect === project.aspect) ?? "9:16",
        status: STATUSES.find((status) => status === project.status) ?? "draft",
        scriptMs: project.scriptMs ?? null,
        lastError: project.lastErrorCode ?? null,
        approvedAt: project.approvedAt ?? null,
        approvedByName: project.approvedByName ?? null,
        publishedAt: project.publishedAt ?? null,
        script: project.script.map((scene) => ({
            ...scene,
            role: ROLES.find((role) => role === scene.role) ?? "body",
            media: scene.media ?? null,
        })),
        render: render
            ? {
                  ...render,
                  status: renderStatus,
                  stage: render.stage ?? null,
                  durationMs: render.durationMs ?? null,
                  sizeBytes: render.sizeBytes ?? null,
                  error: render.errorCode ?? null,
                  videoUrl: render.videoUrl ?? null,
                  captionsUrl: render.captionsUrl ?? null,
                  captionsLang: render.captionsLang ?? null,
                  downloadUrl: render.downloadUrl ?? null,
                  posterUrl: render.posterUrl ?? null,
              }
            : null,
    }
}

/** Adapts a generated media payload to the gallery's supported media kinds. */
export const mediaItemOf = (item: VideoMediaType): MediaItem => ({
    path: item.path,
    name: item.name,
    kind: item.kind === "video" ? "video" : "image",
    url: item.url ?? null,
})

/** The brand kit as the editor holds it: the optional fields are explicit. */
export const brandOf = (brand: VideoBrandType): Brand => ({
    ...brand,
    logoPath: brand.logoPath ?? null,
    musicTrack: brand.musicTrack ?? null,
})
