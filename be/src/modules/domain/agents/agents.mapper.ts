import { storedAvatarAddress } from "@modules/integrations/object-storage"
import type { AgentPersona, AgentProfile, AgentRef, AgentSummary, OptionalAgentProfile } from "./agents.contracts"
import type { AgentEntity } from "./persistence/entities"

/** The columns of an agent the mappers read. */
export type AgentRecord = Pick<
    AgentEntity,
    | "id"
    | "module"
    | "name"
    | "handle"
    | "role"
    | "instructions"
    | "knowledge"
    | "approvalRule"
    | "status"
    | "avatarUrl"
    | "createdAt"
>

/** An agent row as the instance list shows it. */
export const summaryOf = (row: AgentRecord): AgentSummary => ({
    id: row.id,
    module: row.module,
    name: row.name,
    handle: row.handle,
    role: row.role,
    status: row.status,
    avatarUrl: storedAvatarAddress(row.avatarUrl),
    createdAt: row.createdAt.toISOString(),
})

const profileOf = (row: AgentRecord): AgentProfile => ({
    id: row.id,
    name: row.name,
    handle: row.handle,
    role: row.role,
    instructions: row.instructions,
    knowledge: row.knowledge,
    approval_rule: row.approvalRule,
})

/** An agent row as the reference the Office speaks through. */
export const refOf = (row: AgentRecord): AgentRef => ({ id: row.id, name: row.name })

/** An agent row as the persona the bundle writes; an empty note or rule is no note or rule. */
export const personaOf = (row: AgentRecord): AgentPersona => ({
    name: row.name,
    handle: row.handle,
    role: row.role,
    instructions: row.instructions,
    knowledge: row.knowledge === "" ? null : row.knowledge,
    approvalRule: row.approvalRule === "" ? null : row.approvalRule,
})

/** The profile of the first agent row a query answered; null when it answered none. */
export const firstProfileOf = (row: AgentRecord | null): OptionalAgentProfile => (row === null ? null : profileOf(row))
