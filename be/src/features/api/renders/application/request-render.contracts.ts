/** What request-render takes: the project to render. */
export interface RequestRenderRequest {
    /** The video project; it must belong to a workspace the caller manages. */
    readonly projectId: string
}

/** What request-render answers: the queued render. */
export interface RequestRenderResult {
    /** The new render, waiting for the render job. */
    readonly renderId: string
    /** The project it renders. */
    readonly projectId: string
}
