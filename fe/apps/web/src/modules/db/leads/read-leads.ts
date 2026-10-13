import "server-only"

import { cache } from "react"
import type { LeadListItem } from "@/modules/types"
import { createServerDbClient } from "../server"
import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { toLeadListItems } from "./leads.mapper"

const LEADS_LIMIT = 500
const OPEN_STEPS_LIMIT = 1000

/** Reads every lead of the workspace, newest first, with the owner and next action of its open step; RLS limits the rows to the caller. */
export const readLeads = cache(async (workspaceId: string): Promise<DbOutcome<ReadonlyArray<LeadListItem>>> => {
    const client = await createServerDbClient()
    const [leadsResult, stepsResult] = await Promise.all([
        client
            .from("leads")
            .select("*")
            .eq("workspace_id", workspaceId)
            .order("created_at", { ascending: false })
            .limit(LEADS_LIMIT),
        client
            .from("responsibilities")
            .select("lead_id, owner_name, next_action")
            .eq("workspace_id", workspaceId)
            .neq("status", "done")
            .order("created_at")
            .limit(OPEN_STEPS_LIMIT),
    ])
    const leads = toOutcome(leadsResult)
    if (leads.kind !== "ok") return leads
    const steps = toOutcome(stepsResult)
    if (steps.kind !== "ok") return steps
    return dbOk(toLeadListItems(leads.value, steps.value))
})
