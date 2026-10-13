import "server-only"

import { getLeadFlow } from "@/lib/flow-queries"
import type { LeadFlow } from "@/lib/flow-types"
import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"

/** Reads the work flow of one lead (work items, orders, invoices, payments, decisions); a failed read is a typed failure, never an empty flow. */
export const readLeadFlow = async (leadId: string): Promise<DbOutcome<LeadFlow>> => {
    try {
        return dbOk(await getLeadFlow(leadId))
    } catch (cause) {
        return dbFailure("unavailable", cause instanceof Error ? cause.message : "flow")
    }
}
