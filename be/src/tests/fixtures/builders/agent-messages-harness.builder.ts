import {
    type QueryBuilderAnswers,
    type FakeQueryBuilder,
    queueQueryBuilders,
} from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { MockEntityManager } from "@starci/jest-preset"

/** The answer of an insert that stored these ids. */
export const stored = (...ids: Array<string>): QueryBuilderAnswers => ({ execute: { raw: ids.map((id) => ({ id })) } })

type WithStatementsResultShape = {
    em: MockEntityManager
    fakes: ReadonlyArray<FakeQueryBuilder>
}

/** A manager whose inserts and reads answer these, one fake statement each, in order. */
export const withStatements = (
    em: MockEntityManager,
    ...answers: Array<QueryBuilderAnswers>
): WithStatementsResultShape => {
    return { em, fakes: queueQueryBuilders(em, answers) }
}

/** The exact automated human-labelled message values used by the persistence assertions. */
export const HUMAN_MESSAGE_VALUES = {
    workspaceId: "ws-1",
    conversationId: "conv-1",
    role: "agent",
    body: "Welcome",
    authorKind: "human",
    authorName: "Mai",
} as const

/** Exact list projection of the default stored message. */
export const AGENT_LIST_ROWS = [
    { conversation_id: "conv-1", role: "user", body: "Hello", created_at: "2026-10-12T10:00:00.000Z" },
] as const

/** Exact listChat result asserted by the owner spec. */
export const LIST_CHAT_ROWS = [
    { id: "m-1", role: "user", body: "Hello", createdAt: "2026-10-12T10:00:00.000Z" },
    { id: "m-2", role: "system", body: "Handed over", createdAt: "2026-10-12T10:01:00.000Z" },
    { id: "m-3", role: "agent", body: "Welcome", createdAt: "2026-10-12T10:02:00.000Z" },
] as const

/** Exact transcript result asserted by the owner spec. */
export const TRANSCRIPT_LINES = [
    { role: "agent", body: "Welcome" },
    { role: "user", body: "Price?" },
] as const

/** The exact stable-id output reply values stored before publication. */
export const FINAL_REPLY_VALUES = {
    id: "item-1",
    workspaceId: "ws-1",
    conversationId: "conv-1",
    role: "agent",
    body: "Done",
} as const
