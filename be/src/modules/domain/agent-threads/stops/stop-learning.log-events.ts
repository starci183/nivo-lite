/** Log events of the learning: ids, codes and counts only, never anyone's words. */
export enum StopLearningLogEvent {
    /** A settle kept new candidates (`kept`). */
    CandidatesKept = "stop_learning.candidates_kept",
    /** A card was posted (`changeId`, `candidates`, `kind`, `prompt`). */
    CardPosted = "stop_learning.card_posted",
    /** Three tries gave no usable draft; the candidates stay (`candidate`, `prompt`). */
    DraftFailed = "stop_learning.draft_failed",
    /** The model gave no rule for the place (`candidate`, `prompt`). */
    NoRule = "stop_learning.no_rule",
    /** A group of the draft answer failed an integrity check and was dropped (`candidate`, `numbers`, `why`, `prompt`: the call's pinned version). */
    GroupDropped = "stop_learning.group_dropped",
    /** A settle could not be learned from (logged, never fails the wake). */
    PassFailed = "stop_learning.pass_failed",
    /** The founder decided a card (`changeId`, `state`, `closed`). */
    Decided = "stop_learning.decided",
}
