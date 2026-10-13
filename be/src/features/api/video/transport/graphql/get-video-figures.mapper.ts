import type { WorkbenchFigures } from "@modules/domain/video"
import type { GetVideoFiguresRequest } from "../../application/get-video-figures.contracts"
import type { VideoFiguresType } from "./dto/video-figures.type"

/** Maps the workspace selector into the application request. */
export const toGetVideoFiguresRequest = (workspaceId: string): GetVideoFiguresRequest => ({ workspaceId })

/** Maps the domain result into the GraphQL type. */
export const toGetVideoFiguresType = (result: WorkbenchFigures): VideoFiguresType => ({ ...result })
