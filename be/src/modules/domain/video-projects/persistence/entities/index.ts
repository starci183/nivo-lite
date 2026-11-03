import { VideoProjectEntity } from "./video-project.entity"

export { VideoProjectEntity } from "./video-project.entity"
export type { VideoProjectAspect, VideoProjectGoal, VideoProjectJson, VideoProjectState } from "./video-project.entity"

/** Every entity of the video-projects capability. */
export const videoProjectsEntities: readonly [typeof VideoProjectEntity] = [VideoProjectEntity] as const
