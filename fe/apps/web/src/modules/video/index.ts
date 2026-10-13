export {
    ASPECTS,
    DEFAULT_VOICE,
    DURATIONS,
    LIBRARY_LIMIT,
    MEDIA_BUCKET,
    MEDIA_MAX_BYTES,
    MEDIA_MIME,
    MUSIC_TRACKS,
    SCRIPT_MAX_SCENES,
    SCRIPT_STALE_MS,
    TARGET_SECONDS_MAX,
    TARGET_SECONDS_MIN,
    TTS_VOICES,
    VIDEOS_BUCKET,
    VIDEO_MAX_SECONDS,
} from "./video.constants"
export type { Aspect } from "./video.constants"
export { guardBrand, guardFile, guardNewProject, guardPatch, isUuid } from "./video.guards"
export {
    asciiFold,
    colorOf,
    EMPTY_INPUTS,
    estimateScriptSeconds,
    inWorkspaceFolder,
    isRecord,
    mediaKindOf,
    mediaLabel,
    newScene,
    parseScriptOutput,
    readInputs,
    readScript,
    scenePlan,
    writeInputs,
    writeScript,
} from "./video.script"
export { aspectKey, GOAL_TEMPLATES, isGoal, goalTemplateOf } from "./video.templates"
export { editorHref, stepFor } from "./video.links"
export type { EditorStep } from "./video.links"
export type {
    Brand,
    Goal,
    GoalTemplate,
    MediaFileInfo,
    MediaItem,
    ProjectInputs,
    ProjectStatus,
    ProjectView,
    RenderView,
    SceneRole,
    ScriptScene,
    ShareResult,
    SourceChoice,
    UploadTicket,
    VideoFigures,
} from "./video.types"
