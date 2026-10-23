import type { OpenApiAuthDraft } from "@modules/domain/data-hub"

/** What saveOpenApiConnection takes. */
export interface SaveOpenApiConnectionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection to update; null creates one. */
    readonly connectionId?: string | null | undefined
    /** The name. */
    readonly name: string
    /** The configuration, cleaned by the back end. */
    readonly config: unknown
    /** The credential typed. */
    readonly auth: OpenApiAuthDraft
    /** Minutes between scheduled syncs: null, 15, 60, 360 or 1440. */
    readonly syncEveryMinutes?: number | null | undefined
}
