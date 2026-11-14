/** Log events of the accuracy and conflict checks of the fact reading (BG2; the coordinator may fold them into `BrainLogEvent`). */
export enum FactReadingLogEvent {
    /** A window's answer held facts its text does not support (no quote, a quote not in the text, a quote without the value): dropped and counted. */
    FactsUngrounded = "brain.extraction.facts_ungrounded",
    /**
     * A window's answer had lines that are not truth lines or not grounded: the good lines are kept, the refused ones counted (fields:
     * counts only; the lines themselves are kept in the reading's `answer_notes`, never in a log line).
     */
    LinesRefused = "brain.extraction.lines_refused",
    /** A window's answer was asked once more with its own answer in front of it (`format` or `language`): a retry that changes the prompt. */
    WindowFollowUp = "brain.extraction.window_follow_up",
    /**
     * A window's answer could not be read even after its follow-up (or was cut with one passage left): the window is skipped, its
     * passages marked for the next reading, and the reading goes on (fields: counts and sizes; the raw answer is in `answer_notes`).
     */
    WindowSkipped = "brain.extraction.window_skipped",
    /** A window cut at its token cap was split in two halves read on their own. */
    WindowSplit = "brain.extraction.window_split",
    /** What a document is was judged once by the model on its map (fields: the nature, who decided, how many tables; never its text). */
    NatureJudged = "brain.nature.judged",
    /** The map's answer could not be read even after its follow-up: the document is triaged passage by passage, as before the map. */
    NatureFallback = "brain.nature.fallback",
    /** The founder answered what a document is (fields: the parts, the readings opened again, the nature or `model` when taken back). */
    NatureAnswered = "brain.nature.answered",
    /** Passages left rule material when the document's nature (or the founder's answer) changed: what they supported was withdrawn. */
    NatureWithdrew = "brain.nature.withdrew",
    /** Lines of rule material neither read into a truth nor skipped, even after the follow-up: counted and kept in the notes (fields: counts). */
    LinesUnaccounted = "brain.extraction.lines_unaccounted",
    /**
     * The date a document states as its own was read for the periods its lines give relative to it (fields: the outcome `stated`,
     * `none` or `unread`; never the date line itself).
     */
    DocumentDateRead = "brain.extraction.document_date_read",
    /** A triage answer cut at its cap or unreadable: its batch was split in two halves judged on their own (D-N-9). */
    TriageSplit = "brain.triage.split",
    /** One passage triage could not sort even alone: judged `rule`, so no rule is lost (its truth reading answers NONE when it states none). */
    TriageFallback = "brain.triage.fallback_rule",
    /** The "same fact in other words" check of one window ran: how many facts were judged and how many flagged for the founder. */
    SameMeaningChecked = "brain.same_meaning.checked",
    /**
     * The vector index did not answer the same-meaning candidate read of a fact: only its word candidates were judged, and a fact with
     * none is left unchecked (never taken as a distinct truth).
     */
    SameMeaningIndexDown = "brain.same_meaning.index_down",
    /** The "same fact in other words" check failed; the facts stand unflagged and the reading goes on. */
    SameMeaningFailed = "brain.same_meaning.failed",
    /** A facts job read its budget of windows (or facts): the reading goes on in a follow-up job from the window it reached. */
    ReadingContinued = "brain.extraction.continued",
    /** A reading that waited for credits goes on: the workspace has credits again. */
    ReadingResumed = "brain.extraction.resumed",
    /** Looking for readings that wait for credits failed; the next upkeep tick looks again. */
    ResumeFailed = "brain.extraction.resume_failed",
    /** A document was not uploaded by the founder (or by nobody): its truths wait for a person. */
    NotFounderDocument = "brain.extraction.not_founder_document",
    /** The truths work of a document was given up after three failed tries in a row; the document stays searchable. */
    ReadingGivenUp = "brain.extraction.given_up",
    /** The founder was told that the truths work of a document stopped (credits, the ceiling, the model). */
    StopReported = "brain.extraction.stop_reported",
    /** Telling the founder failed; the state on the documents page still says why it stopped. */
    StopReportFailed = "brain.extraction.stop_report_failed",
}
