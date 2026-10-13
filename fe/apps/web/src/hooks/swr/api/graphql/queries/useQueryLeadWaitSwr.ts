import { noData, useWorkspaceArgSwr } from "@/hooks/workspaceread"
import { queryLeadWait } from "@/modules/api/graphql/queries/query-lead-wait"

/** Workspace-scoped cache identity for the leadWait query. */
export const QUERY_LEAD_WAIT_SWR_KEY = "QUERY_LEAD_WAIT_SWR"

/** Reads leadWait. The workspace id is part of the cache identity; `undefined` pauses the read. */
export const useQueryLeadWaitSwr = (workspaceId: string | undefined, leadId: string | undefined) =>
    useWorkspaceArgSwr(
        QUERY_LEAD_WAIT_SWR_KEY,
        workspaceId,
        leadId,
        async (value) => (await queryLeadWait({ request: { leadId: value } })).data?.leadWait ?? noData("leadWait"),
    )
