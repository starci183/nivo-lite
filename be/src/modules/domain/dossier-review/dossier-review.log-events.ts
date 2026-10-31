/** Log events of the dossier-review capability. */
export enum DossierReviewLogEvent {
    /** A job arrived with a payload of another shape and was dropped. */
    PayloadRefused = "dossier-review.job.payload_refused",
    /** The evidence check dropped candidates of a run; the reasons are counted. */
    CandidatesDropped = "dossier-review.run.candidates_dropped",
    /** Asking for a review of a source failed; the source is stored all the same. */
    RequestFailed = "dossier-review.run.request_failed",
    /** The model could not review one dossier. */
    ModelUnavailable = "dossier-review.ai.model_unavailable",
}
