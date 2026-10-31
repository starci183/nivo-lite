import { createHash } from "node:crypto"

/** The SHA-256 of the extracted text of a source, in hex; the migration that backfills `knowledge_sources.content_hash` computes the same value. */
export const contentHashOf = (content: string): string => createHash("sha256").update(content, "utf8").digest("hex")
