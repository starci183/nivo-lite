import type { BrandKit } from "@modules/domain/video"

/** Authenticated saveVideoBrand request. */
export interface SaveVideoBrandRequest extends BrandKit {
    /** Active workspace selector. */
    readonly workspaceId: string
}

/** Successful saveVideoBrand result. */
