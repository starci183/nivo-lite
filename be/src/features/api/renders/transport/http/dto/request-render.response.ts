/** The HTTP response of request-render. */
export class RequestRenderResponse {
    /** The new render, waiting for the render job. */
    renderId!: string
    /** The project it renders. */
    projectId!: string
}
