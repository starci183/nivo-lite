/** Log events of the shop-document critic and of the runs that carry it. */
export enum DossierReviewLogEvent {
    /** A job arrived with a payload of another shape and was dropped. */
    PayloadRefused = "dossier-review.job.payload_refused",
    /** The critic of a shop document could not finish (the reason is logged). */
    CritiqueNotDone = "dossier-review.critic.not_done",
    /** The critic of a shop document failed unexpectedly; the review run that carried it goes on. */
    CritiqueFailed = "dossier-review.critic.failed",
    /** The model points of a critique that did not hold were dropped (any kind but text addressed to an AI among them); the reasons are counted. */
    CritiqueDropped = "dossier-review.critic.dropped",
    /** Points of a model answer that did not fit the shape of a point were left out (the kinds they gave are logged); the rest stand. */
    CritiqueRefused = "dossier-review.critic.refused",
    /** More contradiction points of one kind than a document lists one by one were rolled up; the counts per kind are logged. */
    CritiqueCapped = "dossier-review.critic.capped",
    /** A critique ended a slice of its work with progress and waits again behind the workspace's other documents (D-V-3). */
    CritiqueTurnGiven = "dossier-review.critic.turn_given",
    /** A critique was GIVEN UP: not done after `CRITIC_CAPS.runs` runs in a row without progress; nothing asks for it by itself (D-V-1). */
    CritiqueGivenUp = "dossier-review.critic.given_up",
}
