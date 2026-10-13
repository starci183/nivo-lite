import { isoOf } from "@modules/domain/brain-facts"
import type { GapRecord } from "./knowledge-gaps.contracts"
import type { KnowledgeGapRow } from "./persistence/knowledge-gaps.rows"

/** A gap as the callers read it, from the row the database answers. */
export const toGapRecord = (row: KnowledgeGapRow): GapRecord => ({
    id: row.id,
    module: row.module,
    question: row.question,
    topic: row.topic,
    attributeGuess: row.attribute_guess,
    count: row.count,
    firstSeenAt: isoOf(row.first_seen_at),
    lastSeenAt: isoOf(row.last_seen_at),
    exampleConversationId: row.example_conversation_id,
    status: row.status,
    reopenedCount: row.reopened_count,
})
