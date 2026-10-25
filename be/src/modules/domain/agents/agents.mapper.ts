import type { AgentPersona, AgentProfile, AgentRef, AgentSummary, OptionalAgentProfile } from "./agents.contracts"
import type { AgentRow } from "./persistence/agents.rows"

/** An agent row as the instance list shows it. */
export const summaryOf = (row: AgentRow): AgentSummary => ({
    id: row.id,
    module: row.module,
    name: row.name,
    handle: row.handle,
    role: row.role,
    status: row.status,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
})

const profileOf = (row: AgentRow): AgentProfile => ({
    id: row.id,
    name: row.name,
    handle: row.handle,
    role: row.role,
    instructions: row.instructions,
    knowledge: row.knowledge,
    approval_rule: row.approval_rule,
})

/** An agent row as the reference the Office speaks through. */
export const refOf = (row: AgentRow): AgentRef => ({ id: row.id, name: row.name })

/** An agent row as the persona the bundle writes; an empty note or rule is no note or rule. */
export const personaOf = (row: AgentRow): AgentPersona => ({
    name: row.name,
    handle: row.handle,
    role: row.role,
    instructions: row.instructions,
    knowledge: row.knowledge === "" ? null : row.knowledge,
    approvalRule: row.approval_rule === "" ? null : row.approval_rule,
})

/** The profile of the first agent row a query answered; null when it answered none. */
export const firstProfileOf = (rows: ReadonlyArray<AgentRow>): OptionalAgentProfile => {
    const [row] = rows
    return row === undefined ? null : profileOf(row)
}
