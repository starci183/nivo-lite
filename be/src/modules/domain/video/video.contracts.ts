/** A render that was queued for a project. */
export interface RenderQueued {
    /** The new `video_renders` row. */
    readonly renderId: string
    /** The project it renders. */
    readonly projectId: string
}
