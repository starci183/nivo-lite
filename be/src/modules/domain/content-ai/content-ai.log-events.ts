/** Operational evidence retained when generated content cannot be applied. */
export enum ContentAiLogEvent {
    /** Records the original failure along with the request and workspace before a stable failure status is saved. */
    CompletionFailed = "content-ai.completion-failed",
}
