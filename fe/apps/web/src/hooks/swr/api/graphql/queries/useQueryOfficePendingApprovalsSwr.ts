"use client"

import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryOfficePendingApprovals } from "@/modules/api/graphql/queries/query-office-pending-approvals"
import type { ReadResponse } from "@/hooks/workspaceread"
import type { OfficePendingApprovalsQuery } from "@/modules/api"

/** The SWR key of {@link useQueryOfficePendingApprovalsSwr}. */
export const QUERY_OFFICE_PENDING_APPROVALS_SWR_KEY = "QUERY_OFFICE_PENDING_APPROVALS_SWR"

/** The back end `officePendingApprovals` query. */
export const useQueryOfficePendingApprovalsSwr = (
    config?: SWRConfiguration,
): ReadResponse<OfficePendingApprovalsQuery["officePendingApprovals"] | undefined> =>
    useSWR(
        useWorkspaceKey(QUERY_OFFICE_PENDING_APPROVALS_SWR_KEY, []),
        async () => (await queryOfficePendingApprovals()).data?.officePendingApprovals,
        config,
    )
