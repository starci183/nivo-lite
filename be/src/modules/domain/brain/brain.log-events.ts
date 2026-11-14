/** Log events of the brain capability. */
export enum BrainLogEvent {
    /** Taking back what a deleted document contributed failed; the document is gone all the same. */
    WithdrawFailed = "brain.source.withdraw_failed",
    /** Filing one fact read from a document failed; the others are still filed. */
    FilingFailed = "brain.extraction.filing_failed",
    /** Answering the gaps a fact or document covers failed; the fact or document is stored all the same. */
    GapsFailed = "brain.gaps.resolve_failed",
    /** A model answer could not be read at all: no object or list in it parses (one event per answer; length and slices tried, no text). */
    AnswerUnreadable = "brain.model.answer_unreadable",
    /** One slice of a model answer did not parse but another did: the answer was read (the slice kinds only). */
    AnswerSliceRetried = "brain.model.answer_slice_retried",
    /** A command job ended; the outcome says how. */
    CommandRan = "brain.command.ran",
    /** A command was refused by the services; the row carries the stored code. */
    CommandRefused = "brain.command.refused",
    /** Asking for the dossier review of a document that was read, given up or deleted failed; the facts job goes on. */
    ReviewRequestFailed = "brain.dossier_review.request_failed",
    /** One fact of a bulk apply could not be applied (it was decided meanwhile, or the write failed); the others go on. */
    BulkFactSkipped = "brain.bulk.fact_skipped",
    /** A job arrived with a payload of another shape and was dropped. */
    PayloadRefused = "brain.job.payload_refused",
    /** Linking the facts of one document into the truth graph failed; the facts stand without edges. */
    RelationsFailed = "brain.relations.link_failed",
    /** Embedding the facts in force failed; they stay searchable by words and are embedded on the next refresh. */
    EmbeddingsFailed = "brain.embeddings.refresh_failed",
    /** The timed upkeep of one workspace failed (scheduled facts not yet active, ended facts not yet expired); the next tick retries it, the others go on. */
    UpkeepFailed = "brain.upkeep.workspace_failed",
    /** One pass of the timed brain upkeep ended: workspaces kept current, facts that came in force, facts that expired. */
    UpkeepDone = "brain.upkeep.done",
    /** One timed sweep of the fact vectors ended: workspaces visited, facts embedded, facts copied, workspaces left with more to do. */
    VectorsSwept = "brain.embeddings.swept",
    /** The timed sweep of the fact vectors failed as a whole; the facts' own upkeep of the same tick already ran. */
    VectorsSweepFailed = "brain.embeddings.sweep_failed",
    /** A workspace's fact vectors wait: its credit pool is empty (bulk embedding); the next tick after credits return goes on. */
    VectorsBlockedCredits = "brain.embeddings.blocked_credits",
}
