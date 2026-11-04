"use client"

import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryOfficeDecidedApprovals } from "@/modules/api/graphql/queries/query-office-decided-approvals"
import type { ReadResponse } from "@/hooks/workspaceread"
import type { OfficeDecidedApprovalsQuery } from "@/modules/api"

/** The SWR key of {@link useQueryOfficeDecidedApprovalsSwr}. */
export const QUERY_OFFICE_DECIDED_APPROVALS_SWR_KEY = "QUERY_OFFICE_DECIDED_APPROVALS_SWR"

/** The back end `officeDecidedApprovals` query. */
export const useQueryOfficeDecidedApprovalsSwr = (
    config?: SWRConfiguration,
): ReadResponse<OfficeDecidedApprovalsQuery["officeDecidedApprovals"] | undefined> =>
    useSWR(
        useWorkspaceKey(QUERY_OFFICE_DECIDED_APPROVALS_SWR_KEY, []),
        async () => (await queryOfficeDecidedApprovals()).data?.officeDecidedApprovals,
        config,
    )
