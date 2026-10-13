/** Log events of the knowledge capability. */
export enum KnowledgeLogEvent {
    /** A model call could not be recorded in the usage ledger. */
    UsageRecordFailed = "knowledge.usage.record_failed",
    /** The allowance of a workspace could not be read; the call goes ahead. */
    QuotaReadFailed = "knowledge.usage.quota_failed",
    /** The owner notice about the allowance could not be posted. */
    NoticeFailed = "knowledge.usage.notice_failed",
    /** A passage batch could not get its vectors; the passages are stored without them. */
    EmbeddingMissing = "knowledge.embedding.missing",
    /** A source was closed as failed. */
    SourceFailed = "knowledge.source.failed",
    /** Google refused to list a folder picked in the Picker; the owner is asked to pick the files inside. */
    PickedFolderRefused = "knowledge.drive.picked_folder_refused",
    /** A job arrived with a payload of another shape and was dropped. */
    PayloadRefused = "knowledge.job.payload_refused",
    /** A re-embedding job asked for a model this deployment does not embed with and was dropped. */
    ModelMismatch = "knowledge.reembed.model_mismatch",
}
