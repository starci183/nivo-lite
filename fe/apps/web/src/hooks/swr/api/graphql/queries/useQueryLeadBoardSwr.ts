import { noData, useWorkspaceSwr } from "@/hooks/workspaceread"
import { queryLeadBoard } from "@/modules/api/graphql/queries/query-lead-board"

/** Workspace-scoped cache identity for the leadBoard query. */
export const QUERY_LEAD_BOARD_SWR_KEY = "QUERY_LEAD_BOARD_SWR"

/** Reads leadBoard. The workspace id is part of the cache identity; `undefined` pauses the read. */
export const useQueryLeadBoardSwr = (workspaceId: string | undefined) =>
    useWorkspaceSwr(
        QUERY_LEAD_BOARD_SWR_KEY,
        workspaceId,
        async () => (await queryLeadBoard()).data?.leadBoard ?? noData("leadBoard"),
    )
