/** Log events of the video capability. */
export enum VideoLogEvent {
    /** A render delivery failed; the queue retries it unless it was the last or the request cannot be rendered. */
    RenderFailed = "video.render.failed",
    /** A render finished and its files are in Storage. */
    RenderDone = "video.render.done",
    /** A progress write failed; the render goes on. */
    ProgressNotRecorded = "video.render.progress-not-recorded",
    /** The work directory could not be listed at start, so no leftovers were swept. */
    WorkDirUnreadable = "video.render.workdir-unreadable",
}
