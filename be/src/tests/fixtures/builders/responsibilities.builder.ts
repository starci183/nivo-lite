import { builder } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { answerQueryBuilders, fakeQueryBuilder } from "./fake-query-builder.builder"
import type { FakeQueryBuilder } from "./fake-query-builder.builder"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import type {
    NewResponsibility,
    ResolvedOwner,
    ResponsibilityRecord,
    ResponsibilityScope,
} from "@modules/domain/responsibilities"

/** The evidence-log entry a responsibility assignment records, with the given summary. */
export const assignedEvent = (summary: string) => ({
    workspaceId: "ws-1",
    kind: "responsibility.assigned",
    actor: "An",
    summary,
    leadId: "lead-1",
})

/** A named follow-up to open for a customer. */
export const task = {
    leadId: "lead-1",
    title: "Nurture Binh",
    ownerName: "Linh",
    nextAction: "Call back",
    dueAt: "2026-10-14T10:00:00.000Z",
}

/** The customer lookup answer. */
export const LEAD = { contact_name: "Binh" }

/** The scope the journal acts in. */
export const ctx: ResponsibilityScope = { workspaceId: "ws-1", actor: "An", locale: "en" }

/** A stored responsibility as the journal answers it, with any field overridden. */
export const rowOf = builder<ResponsibilityRecord>({
    id: "resp-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    title: "Follow up with Binh",
    owner_kind: "agent",
    owner_agent_id: "agent-1",
    owner_member_id: null,
    owner_name: "Sales Agent",
    next_action: "Classify",
    due_at: "2026-10-13T10:00:00.000Z",
    status: "open",
    created_at: "2026-10-12T10:00:00.000Z",
})

/** The acting member, with any field overridden. */
export const memberOf = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "staff",
    staffId: null,
    displayName: "An",
    status: "active",
})

/** A person owner, with any field overridden. */
export const personOf = builder<ResolvedOwner>({ kind: "human", agentId: null, memberId: "member-1", name: "An" })

/** An agent owner, with any field overridden. */
export const agentOwner = builder<ResolvedOwner>({
    kind: "agent",
    agentId: "agent-1",
    memberId: null,
    name: "Sales Agent",
})

/** A new responsibility as a caller asks for it, with any field overridden. */
export const inputOf = builder<NewResponsibility>({
    lead_id: "lead-1",
    title: "Call Binh",
    owner: "member-1",
    next_action: "Call",
    due_at: null,
})

/** The step an insert writes for the default input and the person owner, with any field overridden. */
export const stepOf = (overrides: Record<string, unknown> = {}) => ({
    workspaceId: "ws-1",
    leadId: "lead-1",
    title: "Call Binh",
    ownerKind: "human",
    ownerAgentId: null,
    ownerMemberId: "member-1",
    ownerName: "An",
    nextAction: "Call",
    dueAt: null,
    ...overrides,
})

/** Queues the guarding customer read (held `FOR SHARE`) and the insert, after the builders already queued. */
export const answerInsert = (
    em: MockEntityManager,
    lead: unknown,
    inserted: ReadonlyArray<unknown>,
    ...before: Array<FakeQueryBuilder>
) => {
    const read = fakeQueryBuilder({ getRawOne: lead })
    const write = fakeQueryBuilder({ execute: { raw: inserted } })
    answerQueryBuilders(em, ...before, read, write)
    return { read, write }
}
