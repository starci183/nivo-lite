import { useStatusPollSwr } from "@/hooks/reuseables/useStatusPollSwr"
import type { StatusPollOptions } from "@/hooks/reuseables/useStatusPollSwr"
import { queryLeadGenCommentStatus } from "@/modules/api/graphql/queries/query-lead-gen-comment-status"

/** The SWR key of the leadGenCommentStatus query. */
export const QUERY_LEAD_GEN_COMMENT_STATUS_SWR_KEY = "QUERY_LEAD_GEN_COMMENT_STATUS_SWR"

/** How often the public-comment approval of a work item is read again. */
const LEAD_GEN_COMMENT_STATUS_REFRESH_MS = 2_000

/** Polls the public-comment approval of a work item until it succeeds or fails. */
export const useQueryLeadGenCommentStatusSwr = (
    workspaceId: string | undefined,
    workItemId: string | undefined,
    options: StatusPollOptions = {},
) =>
    useStatusPollSwr(
        workspaceId === undefined || workItemId === undefined
            ? null
            : [QUERY_LEAD_GEN_COMMENT_STATUS_SWR_KEY, workspaceId, workItemId],
        async ([, , id]) => {
            const result = await queryLeadGenCommentStatus({ request: { workItemId: id } })
            if (!result.data) throw new Error("leadGenCommentStatus answered no data")
            return result.data.leadGenCommentStatus
        },
        LEAD_GEN_COMMENT_STATUS_REFRESH_MS,
        options,
    )
