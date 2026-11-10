/** Log events of the LangChain integration. Fields name the model, status and error class; never a key or a prompt. */
export enum AiLogEvent {
    /** A base URL is known but no virtual key is set: AI stays unavailable until `STARCI_AI_KEY` is sealed. */
    VirtualKeyMissing = "ai.virtual_key.missing",
    /** The retrieval step failed; the prompt goes out without business notes. */
    RetrievalFailed = "ai.retrieval.failed",
    /** A chat call failed; the caller falls back. */
    ChatFailed = "ai.chat.failed",
    /**
     * A chat call answered: the model, the upstream that served it, the size of the prompt (`prompt`) and how much of it came from the
     * provider's prompt cache (`cached`), both counted in the model's units, and a digest of the system text that opens the prompt (its stable part). Two calls with the same digest sent
     * the same prefix, so a missing cache hit between them is the provider's, not the prompt's. Never the prompt itself.
     */
    ChatAnswered = "ai.chat.answered",
    /** A chat answer was cut at the token limit (finish reason `length`): it is a failure, never an answer. */
    ChatCut = "ai.chat.cut",
    /** A chat call answered no text. */
    ChatEmpty = "ai.chat.empty",
    /** An embeddings call failed; the passages are stored without vectors. */
    EmbeddingFailed = "ai.embedding.failed",
}
