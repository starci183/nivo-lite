/** Log events of the language-model integration. */
export enum LlmLogEvent {
    /** The embeddings provider answered a failure status; the passages are stored without vectors. */
    EmbeddingRefused = "llm.embedding.refused",
    /** The embeddings provider could not be reached or answered an unexpected shape. */
    EmbeddingFailed = "llm.embedding.failed",
    /** The chat provider answered a failure status. */
    CompletionRefused = "llm.completion.refused",
    /** The chat provider could not be reached or answered nothing usable. */
    CompletionFailed = "llm.completion.failed",
    /** A provider answer was not JSON. */
    BodyUnreadable = "llm.body.unreadable",
}
