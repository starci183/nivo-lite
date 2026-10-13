import "server-only"

import { cache } from "react"
import type { Execution, Lead, LeadDetail, Responsibility, ResponsibilityWithLead } from "@/lib/types"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { toAgents, toEvent, toExecution, toLead, toResponsibility, toResponsibilityWithLead } from "./overview.mapper"

const LEAD_LIMIT = 5000
const ROW_LIMIT = 2000

/** The owner and next action of an open responsibility. */
export type OpenResponsibility = Pick<Responsibility, "lead_id" | "owner_name" | "next_action">

/** The leads of one workspace, newest first, under the caller RLS. */
export const readLeads = cache(async (workspaceId: string): Promise<DbOutcome<Array<Lead>>> => {
    const client = await createServerDbClient()
    const rows = toOutcome(
        await client
            .from("leads")
            .select("*")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(LEAD_LIMIT),
    )
    return rows.kind === "ok" ? dbOk(rows.value.map(toLead)) : rows
})

/** The open responsibilities of one workspace (owner and next action per lead). */
export const readOpenResponsibilities = cache(
    async (workspaceId: string): Promise<DbOutcome<Array<OpenResponsibility>>> => {
        const client = await createServerDbClient()
        const rows = toOutcome(
            await client
                .from("responsibilities")
                .select("lead_id, owner_name, next_action, status")
                .eq("workspace_id", workspaceId)
                .neq("status", "done")
                .limit(ROW_LIMIT),
        )
        if (rows.kind !== "ok") return rows
        return dbOk(
            rows.value.map((row) => ({
                lead_id: row.lead_id,
                owner_name: row.owner_name,
                next_action: row.next_action,
            })),
        )
    },
)

/** Every responsibility of one workspace with its lead, due soonest first. */
export const readResponsibilities = cache(
    async (workspaceId: string): Promise<DbOutcome<Array<ResponsibilityWithLead>>> => {
        const client = await createServerDbClient()
        const rows = toOutcome(
            await client
                .from("responsibilities")
                .select("*, lead:leads(id, contact_name, company, stage)")
                .eq("workspace_id", workspaceId)
                .order("due_at", { ascending: true, nullsFirst: false })
                .limit(ROW_LIMIT),
        )
        if (rows.kind !== "ok") return rows
        return dbOk(
            rows.value.flatMap((row) => {
                const joined = toResponsibilityWithLead(row)
                return joined === null ? [] : [joined]
            }),
        )
    },
)

/** The executions of some responsibilities, oldest first. */
const readExecutions = async (responsibilityIds: ReadonlyArray<string>): Promise<DbOutcome<Array<Execution>>> => {
    if (responsibilityIds.length === 0) return dbOk([])
    const client = await createServerDbClient()
    const rows = toOutcome(
        await client
            .from("executions")
            .select("*")
            .in("responsibility_id", [...responsibilityIds])
            .order("created_at")
            .limit(ROW_LIMIT),
    )
    return rows.kind === "ok" ? dbOk(rows.value.map(toExecution)) : rows
}

/** One lead with its responsibilities, executions, evidence events and the workspace agents. */
export const readLeadDetail = async (workspaceId: string, leadId: string): Promise<DbOutcome<LeadDetail>> => {
    const client = await createServerDbClient()
    const leads = toOutcome(await client.from("leads").select("*").eq("id", leadId).limit(1))
    if (leads.kind !== "ok") return leads
    const first = leads.value[0]
    if (first === undefined) return dbFailure("not-found", "lead")
    const [responsibilities, events, agents] = await Promise.all([
        client.from("responsibilities").select("*").eq("lead_id", leadId).order("created_at").limit(ROW_LIMIT),
        client
            .from("events")
            .select("*")
            .eq("lead_id", leadId)
            .order("created_at", { ascending: false })
            .limit(ROW_LIMIT),
        client.from("agents").select("*").eq("workspace_id", workspaceId).order("created_at").limit(ROW_LIMIT),
    ])
    const responsibilityRows = toOutcome(responsibilities)
    if (responsibilityRows.kind !== "ok") return responsibilityRows
    const eventRows = toOutcome(events)
    if (eventRows.kind !== "ok") return eventRows
    const agentRows = toOutcome(agents)
    if (agentRows.kind !== "ok") return agentRows
    const executions = await readExecutions(responsibilityRows.value.map((row) => row.id))
    if (executions.kind !== "ok") return executions
    return dbOk({
        lead: toLead(first),
        responsibilities: responsibilityRows.value.map(toResponsibility),
        executions: executions.value,
        events: eventRows.value.map(toEvent),
        agents: toAgents(agentRows.value),
    })
}

/** The lead behind each pending approval, newest approval first. */
export const readPendingApprovals = cache(
    async (workspaceId: string): Promise<DbOutcome<Array<{ readonly leadId: string | null }>>> => {
        const client = await createServerDbClient()
        const rows = toOutcome(
            await client
                .from("executions")
                .select("id, responsibility_id, created_at, responsibility:responsibilities(lead_id)")
                .eq("workspace_id", workspaceId)
                .eq("status", "pending_approval")
                .order("created_at", { ascending: false })
                .limit(ROW_LIMIT),
        )
        if (rows.kind !== "ok") return rows
        return dbOk(rows.value.map((row) => ({ leadId: row.responsibility?.lead_id ?? null })))
    },
)
