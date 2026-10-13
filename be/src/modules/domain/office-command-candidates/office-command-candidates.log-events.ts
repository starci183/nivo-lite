/** Log events of the office capability. */
export enum OfficeCommandCandidatesLogEvent {
    /** The model call that reads a message into a command failed; the owner gets a reply instead of a card. */
    CommandReadFailed = "office.command_read_failed",
    /** The evidence line of a new candidate could not be written; the candidate stands. */
    EvidenceFailed = "office.evidence_failed",
}
