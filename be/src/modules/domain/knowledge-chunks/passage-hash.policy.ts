import { createHash } from "node:crypto"
import { normalizeText } from "./chunk.policy"

/** The hex SHA-256 of a text. */
const sha256 = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex")

/** What a passage says, whatever model embedded it: two passages with the same normalised text have the same hash. */
export const passageTextHashOf = (text: string): string => sha256(normalizeText(text))

/**
 * What a vector of a passage stands for: its normalised text and the model that embedded it, so a vector of another model never counts.
 * The migration that backfills `knowledge_chunks.content_hash` computes the same value from the stored text, which is already normalised.
 */
export const passageHashOf = (text: string, model: string): string => sha256(`${normalizeText(text)}\n${model}`)
