import type { BrandKit } from "@modules/domain/video"
import type { SaveVideoBrandRequest } from "../../application/save-video-brand.contracts"
import type { SaveVideoBrandInput } from "./dto/save-video-brand.input"
import type { VideoBrandType } from "./dto/video-brand.type"

/** Maps the workspace selector into the application request. */
export const toSaveVideoBrandRequest = (workspaceId: string, input: SaveVideoBrandInput): SaveVideoBrandRequest => ({
    workspaceId,
    shopName: input.shopName,
    primary: input.primary,
    secondary: input.secondary,
    logoPath: input.logoPath,
    musicTrack: input.musicTrack,
    voice: input.voice,
})

/** Maps the domain result into the GraphQL type. */
export const toSaveVideoBrandType = (result: BrandKit): VideoBrandType => ({ ...result })
