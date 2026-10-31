import type { EntityManager } from "typeorm"
import { brainFactsEntities } from "@modules/domain/brain-facts"
import { mcpCallLogEntities } from "@modules/domain/mcp-call-log"
import { mcpToolGrantsEntities } from "@modules/domain/mcp-tool-grants"

const [BrainFactEntity] = brainFactsEntities
const [McpCallLogEntity] = mcpCallLogEntities
const [McpToolGrantEntity] = mcpToolGrantsEntities

/** One fact of a workspace as a native-tools scenario seeds it. */
interface SeededFact {
    readonly workspaceId: string
    readonly subject: string
    readonly attribute: string
    readonly value: string
    readonly scope: "public" | "internal"
}

/** The key a label is filed under. */
const keyOf = (text: string): string => text.toLowerCase().replaceAll(" ", "-")

/** Persists one active fact of the owner, in force for good, about the business. */
export const persistActiveFact = async (manager: EntityManager, fact: SeededFact): Promise<void> => {
    await manager.insert(BrainFactEntity, {
        workspaceId: fact.workspaceId,
        subjectType: "business",
        subjectKey: keyOf(fact.subject),
        subjectLabel: fact.subject,
        attribute: keyOf(fact.attribute),
        attributeLabel: fact.attribute,
        value: fact.value,
        scope: fact.scope,
        status: "active",
        sourceKind: "owner",
        trust: 95,
        proposedBy: "owner",
    })
}

/** Grants an agent one tool in auto mode. */
export const grantTool = async (
    manager: EntityManager,
    workspaceId: string,
    agentId: string,
    tool: string,
): Promise<void> => {
    await manager.insert(McpToolGrantEntity, { workspaceId, agentId, tool, mode: "auto" })
}

/** The workspace and agent of one tenant of a scenario. */
interface Tenant {
    readonly workspaceId: string
    readonly agentId: string
}

/**
 * Seeds the Brain scenario of the native-tools proof: the first tenant has a public and an internal fact, the second a public fact of
 * its own, and each agent holds a grant on `brain.search` only.
 */
export const persistBrainScenario = async (manager: EntityManager, own: Tenant, other: Tenant): Promise<void> => {
    const shop = { subject: "Shop", attribute: "Opening hours" } as const
    await Promise.all([
        persistActiveFact(manager, { ...shop, workspaceId: own.workspaceId, value: "8 to 21 every day", scope: "public" }),
        persistActiveFact(manager, {
            workspaceId: own.workspaceId,
            subject: "Shop",
            attribute: "Margin",
            value: "40 percent on every sale",
            scope: "internal",
        }),
        persistActiveFact(manager, { ...shop, workspaceId: other.workspaceId, value: "9 to 17 weekdays", scope: "public" }),
        grantTool(manager, own.workspaceId, own.agentId, "brain.search"),
        grantTool(manager, other.workspaceId, other.agentId, "brain.search"),
    ])
}

/** What the audit stored of one call. */
interface StoredCall {
    readonly tool: string
    readonly outcome: string
    readonly argsMasked: string
    readonly resultSummary: string
}

/** The audit lines of an agent's calls to one tool, with the masked arguments and result summary the console would read. */
export const storedCallsOf = async (manager: EntityManager, agentId: string, tool: string): Promise<Array<StoredCall>> => {
    const rows = await manager.find(McpCallLogEntity, { where: { agentId, tool }, take: 10 })
    return rows.map((row) => ({
        tool: row.tool,
        outcome: row.outcome,
        argsMasked: JSON.stringify(row.argsMasked),
        resultSummary: row.resultSummary,
    }))
}
