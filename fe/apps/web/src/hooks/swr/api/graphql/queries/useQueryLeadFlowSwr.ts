import { noData, useWorkspaceArgSwr } from "@/hooks/workspaceread"
import { queryLeadFlow } from "@/modules/api/graphql/queries/query-lead-flow"

/** Workspace-scoped cache identity for the leadFlow query. */
export const QUERY_LEAD_FLOW_SWR_KEY = "QUERY_LEAD_FLOW_SWR"

/** Reads leadFlow. The workspace id is part of the cache identity; `undefined` pauses the read. */
export const useQueryLeadFlowSwr = (workspaceId: string | undefined, leadId: string | undefined) =>
    useWorkspaceArgSwr(
        QUERY_LEAD_FLOW_SWR_KEY,
        workspaceId,
        leadId,
        async (value) => (await queryLeadFlow({ request: { leadId: value } })).data?.leadFlow ?? noData("leadFlow"),
    )
