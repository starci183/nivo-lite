import "server-only"

import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import type { ChatbotThread } from "@/modules/types"
import { buildChatbotThread, waitingConversationId } from "./chatbot.mapper"
import type { LeadRow } from "./chatbot.mapper"

/** Which conversation to open. */
export interface ChatbotThreadQuery {
    readonly workspaceId: string
    readonly conversationId: string
}

const MESSAGE_LIMIT = 500
const WAITING_LIMIT = 200

/** One conversation with its lines, its lead and the open escalation (if any). A conversation of another workspace is not found. */
export const readChatbotThread = async (query: ChatbotThreadQuery): Promise<DbOutcome<ChatbotThread>> => {
    const client = await createServerDbClient()
    const conversations = toOutcome(
        await client
            .from("agent_conversations")
            .select("*")
            .eq("id", query.conversationId)
            .eq("workspace_id", query.workspaceId)
            .limit(1),
    )
    if (conversations.kind !== "ok") return conversations
    const conversation = conversations.value[0]
    if (conversation === undefined) return dbFailure("not-found", "chatbot-thread")
    const [messages, waiting] = await Promise.all([
        client
            .from("agent_messages")
            .select("*")
            .eq("conversation_id", conversation.id)
            .order("created_at", { ascending: true })
            .limit(MESSAGE_LIMIT),
        client
            .from("work_items")
            .select("*")
            .eq("workspace_id", query.workspaceId)
            .eq("action", "reply_customer")
            .eq("status", "waiting_decision")
            .order("created_at")
            .limit(WAITING_LIMIT),
    ])
    const messageRows = toOutcome(messages)
    if (messageRows.kind !== "ok") return messageRows
    const waitingRows = toOutcome(waiting)
    if (waitingRows.kind !== "ok") return waitingRows
    const lead = await readLead(client, conversation.lead_id)
    if (lead.kind !== "ok") return lead
    const open = waitingRows.value.find((work) => waitingConversationId(work) === conversation.id)
    const staff = await readStaffName(client, open?.assigned_staff_id ?? null)
    if (staff.kind !== "ok") return staff
    return dbOk(
        buildChatbotThread({
            conversation,
            messages: messageRows.value,
            waiting: waitingRows.value,
            lead: lead.value,
            staffName: staff.value,
        }),
    )
}

type Client = Awaited<ReturnType<typeof createServerDbClient>>

/** The lead a conversation points at, or null when it has none. */
const readLead = async (client: Client, leadId: string | null): Promise<DbOutcome<LeadRow | null>> => {
    if (leadId === null) return dbOk(null)
    const rows = toOutcome(
        await client
            .from("leads")
            .select("id, contact_name, company, stage, need, phone, email")
            .eq("id", leadId)
            .limit(1),
    )
    if (rows.kind !== "ok") return rows
    return dbOk(rows.value[0] ?? null)
}

/** The name of the staff member an escalation is assigned to, or null when it is unassigned. */
const readStaffName = async (client: Client, staffId: string | null): Promise<DbOutcome<string | null>> => {
    if (staffId === null) return dbOk(null)
    const rows = toOutcome(await client.from("staff").select("name").eq("id", staffId).limit(1))
    if (rows.kind !== "ok") return rows
    return dbOk(rows.value[0]?.name ?? null)
}
