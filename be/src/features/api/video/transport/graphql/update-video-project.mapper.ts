import type { WorkbenchProject } from "@modules/domain/video"
import type { UpdateVideoProjectRequest } from "../../application/update-video-project.contracts"
import type { UpdateVideoProjectInput } from "./dto/update-video-project.input"
import type { VideoProjectType } from "./dto/video-project.type"
import { toVideoProjectType } from "./video-project.mapper"

/** Maps the workspace selector into the application request. */
export const toUpdateVideoProjectRequest = (
    workspaceId: string,
    input: UpdateVideoProjectInput,
): UpdateVideoProjectRequest => ({
    workspaceId,
    projectId: input.projectId,
    title: input.title,
    goal: input.goal,
    aspect: input.aspect,
    targetSeconds: input.targetSeconds,
    inputs: input.inputs,
    script: input.script?.map((scene) => ({ ...scene, media: scene.media })),
})

/** Maps the domain result into the GraphQL type. */
export const toUpdateVideoProjectType = (result: WorkbenchProject): VideoProjectType => toVideoProjectType(result)
