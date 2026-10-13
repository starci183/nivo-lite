import type { WorkbenchProject } from "@modules/domain/video"
import type { VideoProjectType } from "./dto/video-project.type"

/** Maps a saved project with its render and editable scenes. */
export const toVideoProjectType = (result: WorkbenchProject): VideoProjectType => ({
    ...result,
    inputs: { ...result.inputs, sourceIds: [...result.inputs.sourceIds], media: [...result.inputs.media] },
    script: result.script.map((scene) => ({ ...scene })),
    render: result.render,
})
