import "server-only"

import { cache } from "react"
import type { DecisionFilter, DecisionRecord } from "@/modules/types"
import { createServerDbClient } from "../server"
import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { toDecisionRecord } from "./decisions.mapper"
import type { DecisionWithLeadRow } from "./decisions.mapper"

const HUMAN_DECIDERS = ["owner", "staff"]

/** Reads the decision history of the workspace, newest first, with the customer name; RLS limits the rows to the caller. */
export const readDecisions = cache(
    async (workspaceId: string, filter: DecisionFilter): Promise<DbOutcome<ReadonlyArray<DecisionRecord>>> => {
        const client = await createServerDbClient()
        let query = client.from("decisions").select("*, lead:leads(contact_name)").eq("workspace_id", workspaceId)
        if (filter.kind === "policy") query = query.eq("decider_kind", "policy")
        if (filter.kind === "human") query = query.in("decider_kind", HUMAN_DECIDERS)
        if (filter.kind === "rejected") query = query.eq("outcome", "rejected")
        if (filter.department !== null) query = query.eq("department", filter.department)
        const result = toOutcome(await query.order("created_at", { ascending: false }).limit(filter.limit))
        if (result.kind !== "ok") return result
        const rows: ReadonlyArray<DecisionWithLeadRow> = result.value
        return dbOk(rows.map(toDecisionRecord))
    },
)
