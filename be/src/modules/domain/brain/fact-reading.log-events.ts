/** Log events of the accuracy and conflict checks of the fact reading (BG2; the coordinator may fold them into `BrainLogEvent`). */
export enum FactReadingLogEvent {
    /** A window's answer held facts its text does not support (no quote, a quote not in the text, a quote without the value): dropped and counted. */
    FactsUngrounded = "brain.extraction.facts_ungrounded",
    /** The "same fact in other words" check of one window ran: how many facts were judged and how many flagged for the founder. */
    SameMeaningChecked = "brain.same_meaning.checked",
    /** The "same fact in other words" check failed; the facts stand unflagged and the reading goes on. */
    SameMeaningFailed = "brain.same_meaning.failed",
}
