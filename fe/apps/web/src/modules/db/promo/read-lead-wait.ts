"use server"
import "server-only"

import type { LeadWait } from "@/modules/promo"
import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { readActiveWorkspace } from "../workspace/read-active-workspace"
import { readChatbotState } from "./read-chatbot-state"

const HIDDEN: LeadWait = { show: false, hours: null, replied: false }
const HOUR_MS = 3_600_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

/** Wait time of a website lead computed from its capture time and its real `execution.approved` events; a client component calls it as an action. */
export const readLeadWait = async (leadId: string): Promise<DbOutcome<LeadWait>> => {
    if (!UUID.test(leadId)) return dbOk(HIDDEN)
    const workspace = await readActiveWorkspace()
    if (workspace.kind !== "ok") return workspace
    const client = await createServerDbClient()
    const [chatbot, lead, events] = await Promise.all([
        readChatbotState(),
        client
            .from("leads")
            .select("channel, created_at")
            .eq("id", leadId)
            .eq("workspace_id", workspace.value.id)
            .maybeSingle(),
        client
            .from("events")
            .select("created_at")
            .eq("lead_id", leadId)
            .eq("kind", "execution.approved")
            .order("created_at", { ascending: true })
            .limit(1),
    ])
    if (chatbot.kind !== "ok") return chatbot
    const leadRow = toOutcome(lead)
    const eventRows = toOutcome(events)
    if (leadRow.kind === "not-found") return dbOk(HIDDEN)
    if (leadRow.kind !== "ok") return leadRow
    if (chatbot.value.hasChatbot || !/website/iu.test(leadRow.value.channel)) return dbOk(HIDDEN)
    const reply = eventRows.kind === "ok" ? eventRows.value[0]?.created_at : undefined
    const end = reply === undefined ? Date.now() : Date.parse(reply)
    const hours = Math.floor((end - Date.parse(leadRow.value.created_at)) / HOUR_MS)
    return dbOk({
        show: true,
        hours: Number.isFinite(hours) && hours >= 1 ? hours : null,
        replied: reply !== undefined,
    })
}
