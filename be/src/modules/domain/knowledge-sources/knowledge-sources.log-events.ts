/** Log events of the knowledge-sources capability. */
export enum KnowledgeSourcesLogEvent {
    /** The progress bar of a source could not be moved; the work goes on. */
    ProgressFailed = "knowledge_sources.progress.failed",
    /** A progress frame could not be pushed; the change itself was stored, and a client reads it on its next snapshot. */
    PublishFailed = "knowledge_sources.progress.publish_failed",
    /** The object a new upload replaced could not be removed from storage; it is left behind, unused. */
    ReplacedObjectKept = "knowledge_sources.upload.replaced_object_kept",
    /** THE AUDIT of a move: a member moved a document (with its parts) from one upload area to the other. */
    AreaMoved = "knowledge_sources.area.moved",
    /** The truths of a moved document took the audience of its area (each truth in force a new version naming the move). */
    AreaTruthsFollowed = "knowledge_sources.area.truths_followed",
}
