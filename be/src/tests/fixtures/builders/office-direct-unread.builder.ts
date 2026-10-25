import type { EntityManager } from "typeorm"
import { eachInOrder } from "@modules/platform/primitives"

/** The ids of one direct-unread proof: two home conversations and one foreign workspace whose rows must never surface. */
export interface OfficeDirectUnreadIdentity {
    readonly workspaceId: string
    readonly foreignWorkspaceId: string
    /** The caller, admitted as the workspace owner. */
    readonly ownerId: string
    /** Two home agents, then a foreign agent. */
    readonly agentIds: readonly [string, string, string]
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
    leadIds: [next(), next(), next()],
    foreignUserId: next(),
})

/** The caller's display name; human lines under it never count against the caller's unread. */
export const OFFICE_DIRECT_OWNER = "Owner Person"

const T0 = "2026-01-01T00:00:00+00:00"

const agentOf = (id: string, workspaceId: string, name: string) => ({
    id,
    workspace_id: workspaceId,
    module: "sales",
    name,
    handle: `unread-proof-${id}`,
    role: "Unread proof",
    instructions: "Persisted direct-unread proof.",
    status: "active",
    created_at: T0,
})

const leadOf = (id: string, workspaceId: string, name: string) => ({
    id,
    workspace_id: workspaceId,
    contact_name: name,
    company: `${name} Co`,
    channel: "web",
    need: "Direct unread proof",
    created_at: T0,
})

const lineOf = (
    workspaceId: string,
    agentId: string | null,
    leadId: string | null,
    authorKind: string,
    authorName: string,
    createdAt: string,
) => ({
    workspace_id: workspaceId,
    author_kind: authorKind,
    author_name: authorName,
    body: `line from ${authorName}`,
    agent_id: agentId,
    lead_id: leadId,
    created_at: createdAt,
})

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

/**
 * Persists the caller's seat, the agents and leads of two workspaces and their lines. The first agent holds three
 * foreign-authored lines plus one written by the caller; the first lead two plus one; the foreign workspace four each.
 */
export const persistOfficeDirectUnread = (
    manager: EntityManager,
    identity: OfficeDirectUnreadIdentity,
): Promise<void> =>
    manager.transaction(async (tx) => {
        await tx.insert("auth.users", { id: identity.ownerId })
        await tx.insert("auth.users", { id: identity.foreignUserId })
        await tx.insert("public.workspaces", {
            id: identity.workspaceId,
            owner_id: identity.ownerId,
            name: "Unread proof",
        })
        await tx.insert("public.workspaces", {
            id: identity.foreignWorkspaceId,
            owner_id: identity.foreignUserId,
            name: "Foreign unread proof",
        })
        // The workspace trigger already seats each owner; the proof only names them.
        await tx.update(
            "public.workspace_members",
            { workspace_id: identity.workspaceId, user_id: identity.ownerId },
            { display_name: OFFICE_DIRECT_OWNER },
        )
        await tx.update(
            "public.workspace_members",
            { workspace_id: identity.foreignWorkspaceId, user_id: identity.foreignUserId },
            { display_name: "Foreign Person" },
        )
        await eachInOrder(identity.agentIds, (id, index) =>
            tx.insert(
                "public.agents",
                agentOf(id, index === 2 ? identity.foreignWorkspaceId : identity.workspaceId, `Agent ${index + 1}`),
            ),
        )
        await eachInOrder(identity.leadIds, (id, index) =>
            tx.insert(
                "public.leads",
                leadOf(id, index === 2 ? identity.foreignWorkspaceId : identity.workspaceId, `Lead ${index + 1}`),
            ),
        )
        await eachInOrder(
            [
                ...linesOf(identity.workspaceId, identity.agentIds[0], null, 3, 1),
                ...linesOf(identity.workspaceId, null, identity.leadIds[0], 2, 1),
                ...linesOf(identity.foreignWorkspaceId, identity.agentIds[2], null, 4, 0),
                ...linesOf(identity.foreignWorkspaceId, null, identity.leadIds[2], 4, 0),
            ],
            (row) => tx.insert("public.messages", row),
        )
    })
