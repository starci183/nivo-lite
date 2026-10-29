import { isoOf } from "@modules/domain/brain-facts"
import type { GapRecord } from "./knowledge-gaps.contracts"
import type { KnowledgeGapEntity } from "./persistence/entities"

/** The columns of a gap the callers read, named as the entity names them; a write answers exactly these. */
export type GapFields = Pick<
    KnowledgeGapEntity,
    | "id"
    | "module"
    | "question"
    | "questionKey"
    | "keywords"
    | "topic"
    | "attributeGuess"
    | "count"
    | "firstSeenAt"
    | "lastSeenAt"
    | "exampleConversationId"
    | "status"
    | "reopenedCount"
>

/** A gap as the callers read it, from the stored entity or the row a write answered. */
export const toGapRecord = (row: GapFields): GapRecord => ({
    id: row.id,
    module: row.module,
    question: row.question,
    topic: row.topic,
    attributeGuess: row.attributeGuess,
    count: row.count,
    firstSeenAt: isoOf(row.firstSeenAt),
    lastSeenAt: isoOf(row.lastSeenAt),
    exampleConversationId: row.exampleConversationId,
    status: row.status,
    reopenedCount: row.reopenedCount,
})
