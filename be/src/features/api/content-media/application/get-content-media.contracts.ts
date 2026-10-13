import type { ContentMediaRequest } from "@modules/domain/content-media"

/** Arguments for the editor's workspace attachment addresses. */
export interface GetContentMediaRequest extends ContentMediaRequest {
    /** The selected workspace; the service proves membership. */
    readonly workspaceId: string
}
