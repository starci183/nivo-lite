import type { BrandKit } from "@modules/domain/video"
import type { GetVideoBrandRequest } from "../../application/get-video-brand.contracts"
import type { VideoBrandType } from "./dto/video-brand.type"

/** Maps the workspace selector into the application request. */
export const toGetVideoBrandRequest = (workspaceId: string): GetVideoBrandRequest => ({ workspaceId })

/** Maps the domain result into the GraphQL type. */
export const toGetVideoBrandType = (result: BrandKit): VideoBrandType => ({ ...result })
