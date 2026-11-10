/** Log events of the dossier-review capability. */
export enum DossierReviewLogEvent {
    /** A job arrived with a payload of another shape and was dropped. */
    PayloadRefused = "dossier-review.job.payload_refused",
    /** The evidence check dropped candidates of a run; the reasons are counted. */
    CandidatesDropped = "dossier-review.run.candidates_dropped",
    /** The model could not review one dossier. */
    ModelUnavailable = "dossier-review.ai.model_unavailable",
    /** The critic of a shop document could not finish (the reason is logged). */
    CritiqueNotDone = "dossier-review.critic.not_done",
    /** The critic of a shop document failed unexpectedly; the review run that carried it goes on. */
    CritiqueFailed = "dossier-review.critic.failed",
    /** The model points of a critique that did not hold were dropped; the reasons are counted. */
    CritiqueDropped = "dossier-review.critic.dropped",
}
