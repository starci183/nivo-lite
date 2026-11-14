import { defineModule, type ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { archiveProjectAction, saveBrandAction, saveProjectAction } from "./actions/video.actions"
import { VIDEO_PERMISSIONS } from "./constants"
import { brandRead, projectRead, projectsRead, renderRead, rendersRead } from "./reads/video.reads"
import { VIDEO_WORKBENCH_SPEC } from "./specs/video.workbench"

/** The module key of Video: every read and action id starts with it. */
export const VIDEO_MODULE_KEY = "video"

/**
 * The Video module: the projects with their script and the makings of their videos, a new project, and the brand kit of the
 * workspace; and the actions that change them. The video itself is made by the `video.produce` graph of the Video agent. The seed spec
 * draws it from the generic blocks.
 */
export const videoModule: ModuleDeclaration = defineModule({
    key: VIDEO_MODULE_KEY,
    namespace: "video",
    agent: {
        tools: [
            TOOL.teamMessagePost,
            TOOL.speechVoiceList,
            TOOL.speechGenerate,
            TOOL.videoGenerate,
            TOOL.videoGenerationGet,
            TOOL.videoCompose,
            TOOL.videoRenderGet,
        ],
    },
    permissions: VIDEO_PERMISSIONS,
    reads: [projectsRead, projectRead, rendersRead, renderRead, brandRead],
    actions: [saveProjectAction, archiveProjectAction, saveBrandAction],
    specs: [VIDEO_WORKBENCH_SPEC],
})
