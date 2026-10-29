import { isoOf } from "@modules/domain/brain-facts"
import { rowShape } from "@modules/platform/database"
import type { GapRecord } from "./knowledge-gaps.contracts"
import type { KnowledgeGapEntity, KnowledgeGapStatus } from "./persistence/entities"

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

/** The columns a write answers, as the database returns them (the RETURNING list names them as the entity does). */
export const isGapReturned = rowShape({
    id: "string",
    module: "string",
    question: "string",
    questionKey: "string",
    keywords: "json",
    topic: "string?",
    attributeGuess: "string?",
    count: "number",
    firstSeenAt: "date",
    lastSeenAt: "date",
    exampleConversationId: "string?",
    status: "string",
    reopenedCount: "number",
})

/** The status a stored text stands for; anything else counts as open. */
const statusOf = (text: string): KnowledgeGapStatus => (text === "answered" || text === "dismissed" ? text : "open")

/** A row a write answered: the gap fields, with the two columns the database does not type (keywords and status). */
export interface GapReturned extends Omit<GapFields, "keywords" | "status"> {
    /** The stored keywords, as the driver decoded them. */
    readonly keywords: unknown
    /** The stored status text. */
    readonly status: string
}

/** The gap fields of a row a write answered and `isGapReturned` proved. */
export const toGapFields = (row: GapReturned): GapFields => ({
    ...row,
    keywords: Array.isArray(row.keywords) ? row.keywords.filter((word): word is string => typeof word === "string") : [],
    status: statusOf(row.status),
})
