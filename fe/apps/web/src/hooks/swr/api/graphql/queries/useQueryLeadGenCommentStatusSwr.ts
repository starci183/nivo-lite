"use client"

import {
    answeredData,
    terminalStatusOptions,
    workspaceArgumentKey,
    type ReadResponse,
    type WorkspaceReadKey,
} from "@/hooks/workspaceread"
import useSWR from "swr"
import type { StatusPollOptions } from "@/hooks/reuseables"
import { queryLeadGenCommentStatus } from "@/modules/api/graphql/queries/query-lead-gen-comment-status"
import type { LeadGenCommentStatusQuery } from "@/modules/api"

/** The SWR key of the leadGenCommentStatus query. */
export const QUERY_LEAD_GEN_COMMENT_STATUS_SWR_KEY = "QUERY_LEAD_GEN_COMMENT_STATUS_SWR"

/** How often the public-comment approval of a work item is read again. */
const LEAD_GEN_COMMENT_STATUS_REFRESH_MS = 2_000

/** Polls the public-comment approval of a work item until it succeeds or fails. */
export const useQueryLeadGenCommentStatusSwr = (
    workspaceId: string | undefined,
    workItemId: string | undefined,
    options: StatusPollOptions = {},
): ReadResponse<LeadGenCommentStatusQuery["leadGenCommentStatus"]> =>
    useSWR(
        workspaceArgumentKey(QUERY_LEAD_GEN_COMMENT_STATUS_SWR_KEY, workspaceId, workItemId),
        async ([, , id]: WorkspaceReadKey<string>) => {
            return answeredData(
                await queryLeadGenCommentStatus({ request: { workItemId: id } }),
                "leadGenCommentStatus",
            ).leadGenCommentStatus
        },
        terminalStatusOptions(LEAD_GEN_COMMENT_STATUS_REFRESH_MS, options),
    )
