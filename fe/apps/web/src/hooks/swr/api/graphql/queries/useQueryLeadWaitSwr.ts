"use client"

import { workspaceArgumentKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRResponse } from "swr"
import { queryLeadWait } from "@/modules/api/graphql/queries/query-lead-wait"
import type { LeadWaitQuery } from "@/modules/api"

/** The SWR key of the leadWait query. */
export const QUERY_LEAD_WAIT_SWR_KEY = "QUERY_LEAD_WAIT_SWR"

/** A website lead's first-response wait, isolated by workspace and lead. */
export const useQueryLeadWaitSwr = (
    workspaceId: string | undefined,
    leadId: string,
): SWRResponse<LeadWaitQuery["leadWait"], Error> =>
    useSWR(workspaceArgumentKey(QUERY_LEAD_WAIT_SWR_KEY, workspaceId, leadId), async () => {
        const result = await queryLeadWait({ request: { leadId } })
        if (!result.data) throw new Error("leadWait answered no data")
        return result.data.leadWait
    })
