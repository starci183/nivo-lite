/** Log events of the public-documents capability. */
export enum PublicDocumentsLogEvent {
    /** A draft job ended with a refusal of the capability; the row says why. */
    DraftRefused = "public_documents.draft.refused",
    /** A customer question has an answer in the public-area documents found and a proposal was made for the owner. */
    ProposalMade = "public_documents.proposal.made",
    /** A customer question has no answer in the public-area documents found, or no agent may search; nothing was proposed. */
    ProposalSkipped = "public_documents.proposal.skipped",
    /** The model answered but the answer did not fit the shape asked for. */
    AnswerUnreadable = "public_documents.answer.unreadable",
    /** The model's answer to a draft call fit its shape: whether it answers, the length of its body, the prompt version; never text. */
    DraftRead = "public_documents.draft.read",
    /** A source's text was cut at its share of what one draft call is shown (the rest is not written from): the document; never text. */
    SourceCut = "public_documents.draft.source_cut",
    /** A read of an internal document through the gateway was refused or failed. */
    ReadRefused = "public_documents.read.refused",
    /**
     * A person's read of an internal document for the draft they asked for (node rights decide): the audit line of the read, naming
     * the workspace, the member (the seat id), the document and what it came to; never the text.
     */
    PersonRead = "public_documents.read.person",
}
