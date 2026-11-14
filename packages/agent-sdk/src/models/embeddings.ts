/**
 * The embeddings profiles NIVO may name (`AI_EMBEDDING_MODEL`) and the ONE model identity each stands for (W2 embedding standard,
 * rule 1). A stored vector records the IDENTITY (`<model>@<dimensions>`), never the profile name: re-pointing a profile to another
 * model then changes the identity, so every vector of the old model reads as stale (re-embedded by the passage job and the facts
 * refresh) and is never compared with a new one. The gateway pools exactly these models as pinned profiles.
 */

/** OpenAI's embeddings model, reached on OpenAI directly (owner 2026-11-11: embeddings on OpenAI, no more OpenRouter). */
export const OPENAI_EMBEDDING_MODEL: "text-embedding-3-small" = "text-embedding-3-small"

/** The default embeddings profile: OpenAI `text-embedding-3-small` at 1536 dimensions, pinned. */
export const EMBEDDING_PROFILE: "embed-oa" = "embed-oa"

/** One model behind an embeddings profile: its id at the provider and the vector length it answers. */
export interface EmbeddingModelOfProfile {
    /** The model id (also its identity: the same model served elsewhere under another id shares it). */
    readonly model: string
    /** The vector length; the pgvector columns are declared with it. */
    readonly dimensions: number
}

/** Every embeddings profile the gateway declares, by name. */
export const EMBEDDING_PROFILES: Readonly<Record<string, EmbeddingModelOfProfile>> = {
    [EMBEDDING_PROFILE]: { model: OPENAI_EMBEDDING_MODEL, dimensions: 1536 },
}

/**
 * The identity a vector made through `profile` is recorded and compared with: `<model>@<dimensions>` for a known profile; for a name
 * the table does not know (the old `embed`, or a raw model name), `profile:<name>`, which never equals a known identity, so its
 * vectors are never mixed with them.
 */
export const embeddingIdentityOf = (profile: string): string => {
    const known = EMBEDDING_PROFILES[profile]
    return known === undefined ? `profile:${profile}` : `${known.model}@${String(known.dimensions)}`
}
