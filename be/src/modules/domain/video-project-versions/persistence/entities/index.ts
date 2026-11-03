import { VideoProjectVersionEntity } from "./video-project-version.entity"

export { VideoProjectVersionEntity } from "./video-project-version.entity"

/** Every entity of the video-project-versions capability. */
export const videoProjectVersionsEntities: readonly [typeof VideoProjectVersionEntity] = [
    VideoProjectVersionEntity,
] as const
