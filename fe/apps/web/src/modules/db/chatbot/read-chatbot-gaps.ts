import "server-only"

import { createServerDbClient } from "../server"
import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { audienceOf } from "@/lib/module-registry"
import { isModuleKey } from "@/lib/modules-shared"
import type { KnowledgeGap } from "@/lib/brain/gaps-shared"
import type { Audience } from "@/lib/brain/shared"

/** One agent the owner can look through: its module, name and audience. */
export interface ChatbotLens {
    readonly module: string
    readonly name: string
    readonly audience: Audience
}

/** The open knowledge gaps and the agents they can be answered for. */
export interface ChatbotGaps {
    readonly gaps: ReadonlyArray<KnowledgeGap>
    readonly lenses: ReadonlyArray<ChatbotLens>
}

const GAP_LIMIT = 50
const AGENT_LIMIT = 100
const GAP_STATUSES: ReadonlyArray<KnowledgeGap["status"]> = ["open", "answered", "dismissed"]

const statusOf = (status: string): KnowledgeGap["status"] => GAP_STATUSES.find((known) => known === status) ?? "open"

/**
 * The questions customers asked that the brain could not answer (most asked first) and the active agents of the workspace as
 * lenses on the brain, under the caller's RLS. Meant for owners and managers.
 */
export const readChatbotGaps = async (workspaceId: string): Promise<DbOutcome<ChatbotGaps>> => {
    const client = await createServerDbClient()
    const [gaps, agents] = await Promise.all([
        client
            .from("knowledge_gaps")
            .select("*")
            .eq("workspace_id", workspaceId)
            .eq("status", "open")
            .order("count", { ascending: false })
            .order("last_seen_at", { ascending: false })
            .limit(GAP_LIMIT),
        client
            .from("agents")
            .select("module, name")
            .eq("workspace_id", workspaceId)
            .eq("status", "active")
            .order("created_at")
            .limit(AGENT_LIMIT),
    ])
    const gapRows = toOutcome(gaps)
    if (gapRows.kind !== "ok") return gapRows
    const agentRows = toOutcome(agents)
    if (agentRows.kind !== "ok") return agentRows
    return dbOk({
        gaps: gapRows.value.map((row) => ({
            id: row.id,
            module: row.module,
            question: row.question,
            topic: row.topic,
            attributeGuess: row.attribute_guess,
            count: row.count,
            firstSeenAt: row.first_seen_at,
            lastSeenAt: row.last_seen_at,
            exampleConversationId: row.example_conversation_id,
            status: statusOf(row.status),
            reopenedCount: row.reopened_count,
        })),
        lenses: agentRows.value
            .filter((agent, position, all) => isModuleKey(agent.module) && all.findIndex((other) => other.module === agent.module) === position)
            .map((agent) => ({
                module: agent.module,
                name: agent.name,
                audience: isModuleKey(agent.module) ? audienceOf(agent.module) : "internal",
            })),
    })
}
