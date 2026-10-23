import type { OpenApiAuthDraft } from "@modules/domain/data-hub"

/** What testOpenApiOperation takes. */
export interface TestOpenApiOperationRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection being edited, when there is one. */
    readonly connectionId?: string | null | undefined
    /** The API's base URL. */
    readonly baseUrl: string
    /** The credential typed. */
    readonly auth: OpenApiAuthDraft
    /** The operation, cleaned by the back end. */
    readonly op: unknown
    /** The fixed query string. */
    readonly fixedQuery: string
    /** The dotted path of the items array the owner typed. */
    readonly itemsPath: string
}
