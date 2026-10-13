/** Log events of the documents integration. */
export enum DocumentsLogEvent {
    /** An answer that should have been JSON was not; the caller treats the body as empty. */
    BodyUnreadable = "documents.body.unreadable",
}
