import { VideoRenderEntity } from "./video-render.entity"

export { VideoRenderEntity } from "./video-render.entity"
export type { VideoRenderState } from "./video-render.entity"

/** Every entity of the video-renders capability. */
export const videoRendersEntities: readonly [typeof VideoRenderEntity] = [VideoRenderEntity] as const
