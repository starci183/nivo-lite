/** Log events of the language-model integration. */
export enum LlmLogEvent {
    /** The embeddings provider answered vectors of another count or size; the passages are stored without vectors. */
    EmbeddingUnexpected = "llm.embedding.unexpected",
}
