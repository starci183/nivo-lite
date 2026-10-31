/** Log events of the dossier-review model calls. */
export enum DossierReviewAiLogEvent {
    /** The model answered but its answer did not fit the schema; the call is repeated once. */
    AnswerUnreadable = "dossier_review_ai.answer_unreadable",
    /** The model answered twice and neither answer fit the schema; the caller gets no answer. */
    AnswerGivenUp = "dossier_review_ai.answer_given_up",
    /** Text in a model answer looked like JSON but did not parse. */
    JsonUnreadable = "dossier_review_ai.json_unreadable",
}
