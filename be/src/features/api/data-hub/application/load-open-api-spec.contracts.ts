/** What loadOpenApiSpec takes. */
export interface LoadOpenApiSpecRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** A link to the spec. */
    readonly specUrl: string
    /** The pasted spec text; wins over the link when not blank. */
    readonly specText: string
}
