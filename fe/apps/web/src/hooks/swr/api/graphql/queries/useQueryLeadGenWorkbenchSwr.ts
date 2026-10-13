import useSWR from "swr"
import { queryLeadGenWorkbench } from "@/modules/api/graphql/queries/query-lead-gen-workbench"
import { toLeadGenWorkbenchData } from "@/modules/utils"

/** The SWR key of the leadGenWorkbench query. */
export const QUERY_LEAD_GEN_WORKBENCH_SWR_KEY = "QUERY_LEAD_GEN_WORKBENCH_SWR"

/** The prospects, sources, comments and Sales handoffs of one Lead Gen instance. */
export const useQueryLeadGenWorkbenchSwr = (workspaceId: string | undefined, installationId: string | null) =>
    useSWR(
        workspaceId === undefined ? null : [QUERY_LEAD_GEN_WORKBENCH_SWR_KEY, workspaceId, installationId],
        async () => {
            const result = await queryLeadGenWorkbench({ request: { installationId } })
            if (!result.data) throw new Error("leadGenWorkbench answered no data")
            return toLeadGenWorkbenchData(result.data.leadGenWorkbench)
        },
    )
