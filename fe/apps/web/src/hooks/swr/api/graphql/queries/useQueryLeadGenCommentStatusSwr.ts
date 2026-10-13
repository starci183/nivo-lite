import type { SWRConfiguration } from "swr"
import { jobPolling, noData, useWorkspaceArgSwr } from "@/hooks/workspaceread"
import { queryLeadGenCommentStatus } from "@/modules/api/graphql/queries/query-lead-gen-comment-status"

/** Workspace-scoped cache identity for the leadGenCommentStatus query. */
export const QUERY_LEAD_GEN_COMMENT_STATUS_SWR_KEY = "QUERY_LEAD_GEN_COMMENT_STATUS_SWR"

/** Reads leadGenCommentStatus and polls until the queued work reaches a terminal status. The workspace id is part of the cache identity; `undefined` pauses the read. */
export const useQueryLeadGenCommentStatusSwr = (
    workspaceId: string | undefined,
    workItemId: string | undefined,
    options?: SWRConfiguration,
) =>
    useWorkspaceArgSwr(
        QUERY_LEAD_GEN_COMMENT_STATUS_SWR_KEY,
        workspaceId,
        workItemId,
        async (value) =>
            (await queryLeadGenCommentStatus({ request: { workItemId: value } })).data?.leadGenCommentStatus ??
            noData("leadGenCommentStatus"),
        jobPolling(options),
    )
