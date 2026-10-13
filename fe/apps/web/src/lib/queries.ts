import "server-only"
import { cache } from "react"
import {
    readAgent,
    readAgents,
    readInstanceNames,
    readLeadDetail,
    readLeads,
    readMessages,
    readOpenResponsibilities,
    readRecentEvents,
    readResponsibilities,
} from "@/modules/db"
import type { DbOutcome } from "@/modules/db"
import { getSession } from "./session"
import type { Agent, EventRow, Lead, LeadDetail, Message, ResponsibilityWithLead } from "./types"

/**
 * Legacy shim of the console readers (agents, leads, responsibilities, Office lines, evidence events). The reads live in
 * `modules/db/overview`; a failed read fails the page (the route error boundary) instead of showing an empty list.
 * Removed with the pages that still import it.
 */

/** The value of a read, or a thrown failure that names its kind and code. */
const unwrap = <Value>(outcome: DbOutcome<Value>): Value => {
    if (outcome.kind !== "ok") throw new Error(`read failed: ${outcome.kind} ${outcome.code}`)
    return outcome.value
}

/** The agents of the signed-in workspace. */
export const listAgents = cache(async (): Promise<Agent[]> => {
    const session = await getSession()
    return withInstanceNames(unwrap(await readAgents(session.workspace.id)))
})

/**
 * Agents with the name of the instance each one drives, for a multi-instance type (several Chatbots, one per branch or Fanpage): lists,
 * Office members and mentions can then tell the branches apart. Names are a courtesy: a failed name read leaves the agents as they are.
 */
export const withInstanceNames = async (agents: ReadonlyArray<Agent>): Promise<Array<Agent>> => {
    if (agents.length === 0) return []
    const names = await readInstanceNames(agents.map((agent) => agent.id))
    if (names.kind !== "ok") return [...agents]
    return agents.map((agent) => ({ ...agent, instance_name: names.value.get(agent.id) ?? null }))
}

/** One agent by id, or null when it is not found. */
export const getAgent = async (id: string): Promise<Agent | null> => {
    const outcome = await readAgent(id)
    if (outcome.kind === "not-found") return null
    return unwrap(outcome)
}

/** A lead with the owner and next action of its open responsibility. */
export type LeadRow = Lead & { owner_name: string | null; next_action: string | null }

/** The leads of the signed-in workspace with their owner and next action. */
export const listLeads = cache(async (): Promise<LeadRow[]> => {
    const session = await getSession()
    const [leads, open] = await Promise.all([
        readLeads(session.workspace.id),
        readOpenResponsibilities(session.workspace.id),
    ])
    return leadRowsFrom(unwrap(leads), unwrap(open))
})

/** Leads with the owner and next action of their open responsibility, from rows already read. */
export const leadRowsFrom = (
    leads: ReadonlyArray<Lead>,
    resp: ReadonlyArray<{ lead_id: string; owner_name: string | null; next_action: string | null }>,
): LeadRow[] =>
    leads.map((lead) => {
        const open = resp.find((row) => row.lead_id === lead.id)
        return { ...lead, owner_name: open?.owner_name ?? null, next_action: open?.next_action ?? null }
    })

/** Every responsibility of the signed-in workspace with its lead. */
export const listResponsibilities = cache(async (): Promise<ResponsibilityWithLead[]> => {
    const session = await getSession()
    return unwrap(await readResponsibilities(session.workspace.id))
})

/** One lead with everything around it, or null when it is not found. */
export const getLeadDetail = async (leadId: string): Promise<LeadDetail | null> => {
    const session = await getSession()
    const outcome = await readLeadDetail(session.workspace.id, leadId)
    if (outcome.kind === "not-found") return null
    return unwrap(outcome)
}

/** The newest Office messages, oldest first. */
export const listMessages = cache(async (limit = 100): Promise<Message[]> => {
    const session = await getSession()
    return unwrap(await readMessages(session.workspace.id, limit))
})

/** The newest evidence events. */
export const listRecentEvents = cache(async (limit = 20): Promise<EventRow[]> => {
    const session = await getSession()
    return unwrap(await readRecentEvents(session.workspace.id, limit))
})
