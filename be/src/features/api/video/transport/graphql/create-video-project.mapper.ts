import type { WorkbenchProject } from "@modules/domain/video"
import type { CreateVideoProjectRequest } from "../../application/create-video-project.contracts"
import type { CreateVideoProjectInput } from "./dto/create-video-project.input"
import type { VideoProjectType } from "./dto/video-project.type"
import { toVideoProjectType } from "./video-project.mapper"

/** Maps the workspace selector into the application request. */
export const toCreateVideoProjectRequest = (
    workspaceId: string,
    input: CreateVideoProjectInput,
): CreateVideoProjectRequest => ({
    workspaceId,
    title: input.title,
    goal: input.goal,
    aspect: input.aspect,
    targetSeconds: input.targetSeconds,
    inputs: input.inputs,
})

/** Maps the domain result into the GraphQL type. */
export const toCreateVideoProjectType = (result: WorkbenchProject): VideoProjectType => toVideoProjectType(result)
