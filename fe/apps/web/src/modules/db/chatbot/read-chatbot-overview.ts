import "server-only"

import { createServerDbClient } from "../server"
import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import type { ChatbotOverview } from "@/modules/types"
import { buildChatbotOverview, emptyChatbotOverview } from "./chatbot.mapper"

/** Which Chatbot's conversations to read. */
export interface ChatbotOverviewQuery {
    readonly workspaceId: string
    /** One instance of a multi-instance Chatbot (one per branch or Fanpage); null reads every Chatbot of the workspace. */
    readonly installationId: string | null
}

const DAY_MS = 86_400_000
const CONVERSATION_LIMIT = 200
const MESSAGE_LIMIT = 6000
const WAITING_LIMIT = 200
const INSTALLATION_LIMIT = 100
const AGENT_LIMIT = 100

type Client = Awaited<ReturnType<typeof createServerDbClient>>

/**
 * The Chatbot agents whose conversations a workbench shows: one instance's own agent (several Chatbots, one per branch or
 * Fanpage), else every Chatbot agent of the workspace (the single-instance case, and legacy agents that predate installations).
 */
const chatbotAgentIds = async (
    client: Client,
    query: ChatbotOverviewQuery,
): Promise<DbOutcome<ReadonlyArray<string>>> => {
    if (query.installationId !== null) {
        const siblings = toOutcome(
            await client
                .from("module_installations")
                .select("id, agent_id")
                .eq("workspace_id", query.workspaceId)
                .eq("module_key", "chatbot")
                .limit(INSTALLATION_LIMIT),
        )
        if (siblings.kind !== "ok") return siblings
        const own = siblings.value.find((installation) => installation.id === query.installationId)
        if (own !== undefined && siblings.value.length > 1) {
            return dbOk(own.agent_id === null ? [] : [own.agent_id])
        }
    }
    const agents = toOutcome(
        await client
            .from("agents")
            .select("id")
            .eq("workspace_id", query.workspaceId)
            .eq("module", "chatbot")
            .limit(AGENT_LIMIT),
    )
    if (agents.kind !== "ok") return agents
    return dbOk(agents.value.map((agent) => agent.id))
}

/** Customer conversations of one Chatbot instance (or of the workspace's Chatbot), newest activity first, with the header metrics. */
export const readChatbotOverview = async (query: ChatbotOverviewQuery): Promise<DbOutcome<ChatbotOverview>> => {
    const client = await createServerDbClient()
    const now = Date.now()
    const agentIds = await chatbotAgentIds(client, query)
    if (agentIds.kind !== "ok") return agentIds
    if (agentIds.value.length === 0) return dbOk(emptyChatbotOverview(query.workspaceId, now))

    const conversations = toOutcome(
        await client
            .from("agent_conversations")
            .select("*")
            .eq("workspace_id", query.workspaceId)
            .eq("kind", "customer")
            .in("agent_id", [...agentIds.value])
            .order("created_at", { ascending: false })
            .limit(CONVERSATION_LIMIT),
    )
    if (conversations.kind !== "ok") return conversations
    if (conversations.value.length === 0) return dbOk(emptyChatbotOverview(query.workspaceId, now))

    const ids = conversations.value.map((row) => row.id)
    const leadIds = conversations.value.flatMap((row) => (row.lead_id === null ? [] : [row.lead_id]))
    const since = new Date(now - 30 * DAY_MS).toISOString()
    const [messages, waiting, leads] = await Promise.all([
        client
            .from("agent_messages")
            .select("id, conversation_id, role, body, created_at")
            .eq("workspace_id", query.workspaceId)
            .in("conversation_id", ids)
            .gte("created_at", since)
            .order("created_at", { ascending: true })
            .limit(MESSAGE_LIMIT),
        client
            .from("work_items")
            .select("id, subject_id, proposal")
            .eq("workspace_id", query.workspaceId)
            .eq("action", "reply_customer")
            .eq("status", "waiting_decision")
            .limit(WAITING_LIMIT),
        client
            .from("leads")
            .select("id, contact_name, created_at")
            .eq("workspace_id", query.workspaceId)
            .in("id", leadIds)
            .limit(CONVERSATION_LIMIT),
    ])
    const messageRows = toOutcome(messages)
    if (messageRows.kind !== "ok") return messageRows
    const waitingRows = toOutcome(waiting)
    if (waitingRows.kind !== "ok") return waitingRows
    const leadRows = toOutcome(leads)
    if (leadRows.kind !== "ok") return leadRows
    return dbOk(
        buildChatbotOverview({
            workspaceId: query.workspaceId,
            now,
            conversations: conversations.value,
            messages: messageRows.value,
            waiting: waitingRows.value,
            leads: leadRows.value,
        }),
    )
}
