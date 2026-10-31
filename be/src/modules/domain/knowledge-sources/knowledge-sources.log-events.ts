/** Log events of the knowledge-sources capability. */
export enum KnowledgeSourcesLogEvent {
    /** The progress bar of a source could not be moved; the work goes on. */
    ProgressFailed = "knowledge_sources.progress.failed",
    /** A progress frame could not be pushed; the change itself was stored, and a client reads it on its next snapshot. */
    PublishFailed = "knowledge_sources.progress.publish_failed",
}
