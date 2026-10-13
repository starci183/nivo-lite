import "server-only"

import type { LeadJourney } from "@/modules/types"
import { createServerDbClient } from "../server"
import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { toAgentRecord, toEventRecord, toExecutionRecord, toLeadRecord, toResponsibilityRecord } from "./leads.mapper"

const STEPS_LIMIT = 200
const EVENTS_LIMIT = 500
const AGENTS_LIMIT = 200
const EXECUTIONS_LIMIT = 500

/** Reads one lead of the workspace with its steps, drafts, evidence log and agents; a lead the caller cannot see answers not-found. */
export const readLead = async (workspaceId: string, leadId: string): Promise<DbOutcome<LeadJourney>> => {
    const client = await createServerDbClient()
    const lead = toOutcome(
        await client.from("leads").select("*").eq("workspace_id", workspaceId).eq("id", leadId).maybeSingle(),
    )
    if (lead.kind !== "ok") return lead
    const [stepsResult, eventsResult, agentsResult] = await Promise.all([
        client.from("responsibilities").select("*").eq("lead_id", leadId).order("created_at").limit(STEPS_LIMIT),
        client
            .from("events")
            .select("*")
            .eq("lead_id", leadId)
            .order("created_at", { ascending: false })
            .limit(EVENTS_LIMIT),
        client.from("agents").select("*").eq("workspace_id", workspaceId).order("created_at").limit(AGENTS_LIMIT),
    ])
    const steps = toOutcome(stepsResult)
    if (steps.kind !== "ok") return steps
    const events = toOutcome(eventsResult)
    if (events.kind !== "ok") return events
    const agents = toOutcome(agentsResult)
    if (agents.kind !== "ok") return agents
    const executions = toOutcome(
        await client
            .from("executions")
            .select("*")
            .in(
                "responsibility_id",
                steps.value.map((step) => step.id),
            )
            .order("created_at")
            .limit(EXECUTIONS_LIMIT),
    )
    if (executions.kind !== "ok") return executions
    return dbOk({
        lead: toLeadRecord(lead.value),
        responsibilities: steps.value.map(toResponsibilityRecord),
        executions: executions.value.map(toExecutionRecord),
        events: events.value.map(toEventRecord),
        agents: agents.value.map(toAgentRecord),
    })
}
