/** Log events of the brain capability. */
export enum BrainLogEvent {
    /** Taking back what a deleted document contributed failed; the document is gone all the same. */
    WithdrawFailed = "brain.source.withdraw_failed",
    /** Filing one fact read from a document failed; the others are still filed. */
    FilingFailed = "brain.extraction.filing_failed",
    /** Answering the gaps a fact or document covers failed; the fact or document is stored all the same. */
    GapsFailed = "brain.gaps.resolve_failed",
    /** Text in a model answer looked like JSON but did not parse. */
    AnswerUnreadable = "brain.model.answer_unreadable",
    /** A command job ended; the outcome says how. */
    CommandRan = "brain.command.ran",
    /** A command was refused by the services; the row carries the stored code. */
    CommandRefused = "brain.command.refused",
    /** A job arrived with a payload of another shape and was dropped. */
    PayloadRefused = "brain.job.payload_refused",
}
