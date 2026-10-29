import assert from "node:assert/strict"
import type { EntityManager } from "typeorm"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentConversationEntity } from "@modules/domain/agent-conversations"
import { workspaceMembersEntities } from "@modules/domain/workspace-members"
import { AgentEntity } from "@modules/domain/agents"
import { AgentMessageEntity } from "@modules/domain/agent-messages"
import { leadsEntities } from "@modules/domain/leads"
import { messagesEntities } from "@modules/domain/messages"
import { workspacesEntities } from "@modules/domain/workspaces"

const [WorkspaceEntity] = workspacesEntities
const [WorkspaceMemberEntity] = workspaceMembersEntities

const [LeadEntity] = leadsEntities
const [MessageEntity] = messagesEntities

/** The ids of one direct-unread proof: two home conversations and one foreign workspace whose rows must never surface. */
export interface OfficeDirectUnreadIdentity {
    readonly workspaceId: string
    readonly foreignWorkspaceId: string
    /** The caller, admitted as the workspace owner. */
    readonly ownerId: string
    /** Two home agents, then a foreign agent. */
    readonly agentIds: readonly [string, string, string]
    /** The member test conversation of each of the three agents. */
    readonly conversationIds: readonly [string, string, string]
    /** Two home leads, then a foreign lead. */
    readonly leadIds: readonly [string, string, string]
    /** The foreign caller. */
    readonly foreignUserId: string
}

/** Allocates fresh proof ids for the direct-unread story. */
export const officeDirectUnreadIdentity = (next: () => string): OfficeDirectUnreadIdentity => ({
    workspaceId: next(),
    foreignWorkspaceId: next(),
    ownerId: next(),
    agentIds: [next(), next(), next()],
    conversationIds: [next(), next(), next()],
    leadIds: [next(), next(), next()],
    foreignUserId: next(),
})

/** The caller's current display name; legacy human lines (no account id) under it never count against the caller's unread. */
export const OFFICE_DIRECT_OWNER = "Owner Person"

/** Narrows an indexed fixture id that the persisted story always provides. */
const required = <T>(value: T | undefined): T => {
    assert(value !== undefined)
    return value
}

const T0 = "2026-01-01T00:00:00+00:00"

const agentOf = (id: string, workspaceId: string, name: string) => ({
    id,
    workspaceId: workspaceId,
    module: "sales",
    name,
    handle: `unread-proof-${id}`,
    role: "Unread proof",
    instructions: "Persisted direct-unread proof.",
    status: "active" as const,
    createdAt: T0,
})

const leadOf = (id: string, workspaceId: string, name: string) => ({
    id,
    workspaceId: workspaceId,
    contactName: name,
    company: `${name} Co`,
    channel: "web",
    need: "Direct unread proof",
    createdAt: T0,
})

const lineOf = (
    workspaceId: string,
    agentId: string | null,
    leadId: string | null,
    authorKind: InstanceType<typeof MessageEntity>["authorKind"],
    authorName: string,
    createdAt: string,
    authorUserId: string | null = null,
) => ({
    workspaceId: workspaceId,
    authorKind: authorKind,
    authorName: authorName,
    body: `line from ${authorName}`,
    agentId: agentId,
    leadId: leadId,
    createdAt: createdAt,
    authorUserId: authorUserId,
})

/**
 * The second home agent's thread, which proves who counts as the caller: a chatbot line (counts), a line the caller wrote under an
 * older display name (excluded by account id), a legacy line with no account id under the caller's current name (excluded by the
 * name fallback) and a line by another account who shares the caller's display name (counts).
 */
const identityLinesOf = (identity: OfficeDirectUnreadIdentity) => [
    lineOf(identity.workspaceId, identity.agentIds[1], null, "agent", "Chatbot", "2026-02-02T00:00:00+00:00"),
    lineOf(
        identity.workspaceId,
        identity.agentIds[1],
        null,
        "human",
        "Owner Before The Rename",
        "2026-02-02T00:01:00+00:00",
        identity.ownerId,
    ),
    lineOf(identity.workspaceId, identity.agentIds[1], null, "human", OFFICE_DIRECT_OWNER, "2026-02-02T00:02:00+00:00"),
    lineOf(
        identity.workspaceId,
        identity.agentIds[1],
        null,
        "human",
        OFFICE_DIRECT_OWNER,
        "2026-02-02T00:03:00+00:00",
        identity.foreignUserId,
    ),
]

const linesOf = (
    workspaceId: string,
    agentId: string | null,
    leadId: string | null,
    others: number,
    own: number,
): ReadonlyArray<ReturnType<typeof lineOf>> => [
    ...Array.from({ length: others }, (_, index) =>
        lineOf(
            workspaceId,
            agentId,
            leadId,
            "agent",
            "Chatbot",
            `2026-02-01T00:${String(index).padStart(2, "0")}:00+00:00`,
        ),
    ),
    ...Array.from({ length: own }, (_, index) =>
        lineOf(
            workspaceId,
            agentId,
            leadId,
            "human",
            OFFICE_DIRECT_OWNER,
            `2026-02-01T01:${String(index).padStart(2, "0")}:00+00:00`,
        ),
    ),
]

type Tx = EntityManager

/** The two owners, their workspaces and the names the proof gives their seats. */
const persistPeople = async (tx: Tx, identity: OfficeDirectUnreadIdentity): Promise<void> => {
    await tx.insert("auth.users", { id: identity.ownerId })
    await tx.insert("auth.users", { id: identity.foreignUserId })
    await tx.insert(WorkspaceEntity, { id: identity.workspaceId, ownerId: identity.ownerId, name: "Unread proof" })
    await tx.insert(WorkspaceEntity, {
        id: identity.foreignWorkspaceId,
        ownerId: identity.foreignUserId,
        name: "Foreign unread proof",
    })
    // The workspace trigger already seats each owner; the proof only names them.
    await tx.update(
        WorkspaceMemberEntity,
        { workspaceId: identity.workspaceId, userId: identity.ownerId },
        { displayName: OFFICE_DIRECT_OWNER },
    )
    await tx.update(
        WorkspaceMemberEntity,
        { workspaceId: identity.foreignWorkspaceId, userId: identity.foreignUserId },
        { displayName: "Foreign Person" },
    )
}

/** The agents, their member test conversations and the leads of both workspaces. */
const persistParties = async (tx: Tx, identity: OfficeDirectUnreadIdentity): Promise<void> => {
    const workspaceOf = (index: number): string => (index === 2 ? identity.foreignWorkspaceId : identity.workspaceId)
    await eachInOrder(identity.agentIds, (id, index) =>
        tx.insert(AgentEntity, agentOf(id, workspaceOf(index), `Agent ${index + 1}`)),
    )
    // An agent's direct conversation is the member test chat it answers: one 'test' conversation per agent holds its lines.
    await eachInOrder(identity.agentIds, (id, index) =>
        tx.insert(AgentConversationEntity, {
            id: required(identity.conversationIds[index]),
            workspaceId: workspaceOf(index),
            agentId: id,
            kind: "test",
        }),
    )
    await eachInOrder(identity.leadIds, (id, index) =>
        tx.insert(LeadEntity, leadOf(id, workspaceOf(index), `Lead ${index + 1}`)),
    )
}

/** Writes one line: an agent's lines into its test conversation, a lead's lines into the Office messages. */
const persistLine = (
    tx: Tx,
    identity: OfficeDirectUnreadIdentity,
    row: ReturnType<typeof lineOf>,
): Promise<unknown> => {
    const index = identity.agentIds.findIndex((id) => id === row.agentId)
    if (index < 0) return tx.insert(MessageEntity, row)
    return tx.insert(AgentMessageEntity, {
        workspaceId: row.workspaceId,
        conversationId: required(identity.conversationIds[index]),
        role: row.authorKind === "human" ? "user" : "agent",
        body: row.body,
        createdAt: row.createdAt,
        authorKind: row.authorKind === "human" ? "human" : "ai",
        authorName: row.authorName,
        authorUserId: row.authorUserId,
    })
}

/**
 * Persists the caller's seat, the agents and leads of two workspaces and their lines. The first agent holds three
 * foreign-authored lines plus one written by the caller; the second agent the identity story above (two counted lines); the
 * first lead two plus one; the foreign workspace four each.
 */
export const persistOfficeDirectUnread = (
    manager: EntityManager,
    identity: OfficeDirectUnreadIdentity,
): Promise<void> =>
    manager.transaction(async (tx) => {
        await persistPeople(tx, identity)
        await persistParties(tx, identity)
        const lines = [
            ...linesOf(identity.workspaceId, identity.agentIds[0], null, 3, 1),
            ...identityLinesOf(identity),
            ...linesOf(identity.workspaceId, null, identity.leadIds[0], 2, 1),
            ...linesOf(identity.foreignWorkspaceId, identity.agentIds[2], null, 4, 0),
            ...linesOf(identity.foreignWorkspaceId, null, identity.leadIds[2], 4, 0),
        ]
        await eachInOrder(lines, (row) => persistLine(tx, identity, row))
    })
