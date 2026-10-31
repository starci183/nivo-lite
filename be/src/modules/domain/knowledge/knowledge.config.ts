import type { EnvSource } from "@modules/platform/config"
import type { KnowledgeConfig } from "./knowledge.options"

/** The longest demo pause between two passages: a minute. */
const MAX_CHUNK_DELAY_MS = 60_000

/** Reads `KNOWLEDGE_INDEX_CHUNK_DELAY_MS`, a demo pacing knob (default 0: no wait; it stays 0 in production config). */
export const parseKnowledgeConfig = (env: EnvSource): KnowledgeConfig => ({
    indexChunkDelayMs: Math.max(0, Math.min(MAX_CHUNK_DELAY_MS, env.int("KNOWLEDGE_INDEX_CHUNK_DELAY_MS", 0))),
})
