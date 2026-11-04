"use client"

import {
    jobPolling,
    noData,
    workspaceArgumentKey,
    type ReadResponse,
    type WorkspaceReadKey,
} from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryLeadActionStatus } from "@/modules/api/graphql/queries/query-lead-action-status"
import type { LeadActionStatusQuery } from "@/modules/api"

/** Workspace-scoped cache identity for the leadActionStatus query. */
export const QUERY_LEAD_ACTION_STATUS_SWR_KEY = "QUERY_LEAD_ACTION_STATUS_SWR"

/** One read of the `leadActionStatus` query: the action of the key, or the missing-data failure. */
const readLeadActionStatus = async ([, , input]: WorkspaceReadKey<string>): Promise<
    NonNullable<LeadActionStatusQuery["leadActionStatus"]>
> => (await queryLeadActionStatus({ request: { id: input } })).data?.leadActionStatus ?? noData("leadActionStatus")

/** Reads leadActionStatus and polls until the queued work reaches a terminal status. The workspace id is part of the cache identity; `undefined` pauses the read. */
export const useQueryLeadActionStatusSwr = (
    workspaceId: string | undefined,
    id: string | undefined,
    options?: SWRConfiguration,
): ReadResponse<NonNullable<LeadActionStatusQuery["leadActionStatus"]>> =>
    useSWR(
        workspaceArgumentKey(QUERY_LEAD_ACTION_STATUS_SWR_KEY, workspaceId, id),
        readLeadActionStatus,
        jobPolling(options),
    )
