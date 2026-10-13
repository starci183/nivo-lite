import type { AgentPersona, AgentRef, AgentSummary } from "./agents.contracts"
import type { AgentRow } from "./persistence/agents.rows"

/** An agent row as the instance list shows it. */
export const summaryOf = (row: AgentRow): AgentSummary => ({
    id: row.id,
    module: row.module,
    name: row.name,
    handle: row.handle,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
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
