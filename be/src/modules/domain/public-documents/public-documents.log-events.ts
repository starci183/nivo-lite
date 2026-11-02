/** Log events of the public-documents capability. */
export enum PublicDocumentsLogEvent {
    /** A draft job ended with a refusal of the capability; the row says why. */
    DraftRefused = "public_documents.draft.refused",
    /** A customer question has an answer in the internal documents and a proposal was made for the owner. */
    ProposalMade = "public_documents.proposal.made",
    /** A customer question has no answer in the internal documents, or no agent may read them; nothing was proposed. */
    ProposalSkipped = "public_documents.proposal.skipped",
    /** The model answered but the answer did not fit the shape asked for. */
    AnswerUnreadable = "public_documents.answer.unreadable",
    /** A read of an internal document through the gateway was refused or failed. */
    ReadRefused = "public_documents.read.refused",
}
