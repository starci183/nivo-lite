"use client"

import { workspaceArgumentKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import { queryLeadWait } from "@/modules/api/graphql/queries/query-lead-wait"
import type { OperationData, ReadResponse } from "@/hooks/workspaceread"

/** The SWR key of the leadWait query. */
export const QUERY_LEAD_WAIT_SWR_KEY = "QUERY_LEAD_WAIT_SWR"

/** A website lead's first-response wait, isolated by workspace and lead. */
export const useQueryLeadWaitSwr = (
    workspaceId: string | undefined,
    leadId: string,
): ReadResponse<OperationData<typeof queryLeadWait>["leadWait"]> =>
    useSWR(workspaceArgumentKey(QUERY_LEAD_WAIT_SWR_KEY, workspaceId, leadId), async () => {
        const result = await queryLeadWait({ request: { leadId } })
        if (!result.data) throw new Error("leadWait answered no data")
        return result.data.leadWait
    })
