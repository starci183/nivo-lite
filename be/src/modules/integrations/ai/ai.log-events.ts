/** Log events of the LangChain integration. Fields name the model, status and error class; never a key or a prompt. */
export enum AiLogEvent {
    /** A base URL is known but no virtual key is set: AI stays unavailable until `STARCI_AI_KEY` is sealed. */
    VirtualKeyMissing = "ai.virtual_key.missing",
    /** The retrieval step failed; the prompt goes out without business notes. */
    RetrievalFailed = "ai.retrieval.failed",
    /** A chat call failed; the caller falls back. */
    ChatFailed = "ai.chat.failed",
    /** A chat call answered no text. */
    ChatEmpty = "ai.chat.empty",
    /** An embeddings call failed; the passages are stored without vectors. */
    EmbeddingFailed = "ai.embedding.failed",
}
