/** Log events of the critic model calls. */
export enum DossierReviewAiLogEvent {
    /** The model answered but its answer did not fit the schema; the critic counts the try. */
    AnswerUnreadable = "dossier_review_ai.answer_unreadable",
    /** The answer was cut at the token cap (finish reason): half an answer, never parsed; the cap is logged. */
    AnswerCut = "dossier_review_ai.answer_cut",
    /** Text in a model answer looked like JSON but did not parse. */
    JsonUnreadable = "dossier_review_ai.json_unreadable",
}
