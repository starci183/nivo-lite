import { noData, useWorkspaceArgSwr } from "@/hooks/workspaceread"
import { queryLeadGenWorkbench } from "@/modules/api/graphql/queries/query-lead-gen-workbench"
import type { QueryLeadGenWorkbenchRequest } from "@/modules/api/graphql/queries/query-lead-gen-workbench"

/** Workspace-scoped cache identity for the leadGenWorkbench query. */
export const QUERY_LEAD_GEN_WORKBENCH_SWR_KEY = "QUERY_LEAD_GEN_WORKBENCH_SWR"

/** Reads leadGenWorkbench. The workspace id is part of the cache identity; `undefined` pauses the read. */
export const useQueryLeadGenWorkbenchSwr = (workspaceId: string | undefined, request: QueryLeadGenWorkbenchRequest) =>
    useWorkspaceArgSwr(
        QUERY_LEAD_GEN_WORKBENCH_SWR_KEY,
        workspaceId,
        request,
        async (value) =>
            (await queryLeadGenWorkbench({ request: value })).data?.leadGenWorkbench ?? noData("leadGenWorkbench"),
    )
