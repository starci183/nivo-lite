"use client"

import { argumentKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import { queryBillingWorkspace } from "@/modules/api/graphql/queries/query-billing-workspace"
import type { OperationData, ReadResponse } from "@/hooks/workspaceread"

/** Cache identity of billingWorkspace. */
export const QUERY_BILLING_WORKSPACE_SWR_KEY = "QUERY_BILLING_WORKSPACE_SWR"

/** Reads billingWorkspace for the selected workspace. */
export const useQueryBillingWorkspaceSwr = (
    workspaceId: string | undefined,
): ReadResponse<OperationData<typeof queryBillingWorkspace>["billingWorkspace"]> =>
    useSWR(argumentKey(QUERY_BILLING_WORKSPACE_SWR_KEY, workspaceId), async () => {
        const result = await queryBillingWorkspace()
        if (!result.data) throw new Error("billingWorkspace answered no data")
        return result.data.billingWorkspace
    })
