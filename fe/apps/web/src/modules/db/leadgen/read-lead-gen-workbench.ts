"use server"
import "server-only"

import { isTestRunName, listWorkItems } from "@/lib/flow-queries"
import type { LeadGenWorkbenchData } from "@/modules/types"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { buildLeadGenWorkbench, conversionSinceIso } from "./leadgen.mapper"

const LEADS_LIMIT = 500
const WORK_ITEMS_LIMIT = 600
const CONVERSATIONS_LIMIT = 1000
const MESSAGES_LIMIT = 8000

/** The flow work items; a failed read is a typed failure, never an empty list. */
const readItems = async (): Promise<DbOutcome<Awaited<ReturnType<typeof listWorkItems>>>> => {
    try {
        return dbOk(await listWorkItems({ limit: WORK_ITEMS_LIMIT }))
    } catch (cause) {
        return dbFailure("unavailable", cause instanceof Error ? cause.message : "flow")
    }
}

/**
 * Reads the Lead Gen workbench of one workspace under the caller's RLS. With `installationId` (one Lead Gen agent per page or ad
 * account) only that instance's prospects and work items count.
 */
export const readLeadGenWorkbench = async (
    workspaceId: string,
    installationId: string | null,
): Promise<DbOutcome<LeadGenWorkbenchData>> => {
    const client = await createServerDbClient()
    const nowMs = Date.now()
    const [leadsResult, flow] = await Promise.all([
        client
            .from("leads")
            .select("*")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(LEADS_LIMIT),
        readItems(),
    ])
    const leads = toOutcome(leadsResult)
    if (leads.kind !== "ok") return leads
    if (flow.kind !== "ok") return flow
    const conversations = toOutcome(
        await client
            .from("agent_conversations")
            .select("id, lead_id")
            .eq("workspace_id", workspaceId)
            .eq("kind", "customer")
            .not("lead_id", "is", null)
            .limit(CONVERSATIONS_LIMIT),
    )
    if (conversations.kind !== "ok") return conversations
    const messages = toOutcome(
        await client
            .from("agent_messages")
            .select("conversation_id, role, body, created_at")
            .eq("workspace_id", workspaceId)
            .gte("created_at", conversionSinceIso(nowMs))
            .order("created_at", { ascending: true })
            .limit(MESSAGES_LIMIT),
    )
    if (messages.kind !== "ok") return messages
    return dbOk(
        buildLeadGenWorkbench({
            nowMs,
            installationId,
            leads: leads.value,
            items: flow.value,
            conversations: conversations.value,
            messages: messages.value,
            isTestRun: isTestRunName,
        }),
    )
}
