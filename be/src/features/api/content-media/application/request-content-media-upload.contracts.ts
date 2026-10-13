import type { MediaFile } from "@modules/domain/content-media"

/** Metadata used to authorize one upload into the workspace library. */
export interface RequestContentMediaUploadRequest extends MediaFile {
    /** The selected workspace; the service requires an owner or manager. */
    readonly workspaceId: string
}
