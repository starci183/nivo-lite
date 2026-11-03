"use client"

import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryApproverDirectory } from "@/modules/api/graphql/queries/query-approver-directory"
import type { OperationData, ReadResponse } from "@/hooks/workspaceread"

/** The SWR key of {@link useQueryApproverDirectorySwr}. */
export const QUERY_APPROVER_DIRECTORY_SWR_KEY = "QUERY_APPROVER_DIRECTORY_SWR"

/** The back end `approverDirectory` query. */
export const useQueryApproverDirectorySwr = (
    config?: SWRConfiguration,
): ReadResponse<OperationData<typeof queryApproverDirectory>["approverDirectory"]> =>
    useSWR(
        useWorkspaceKey(QUERY_APPROVER_DIRECTORY_SWR_KEY, []),
        async () => {
            const result = await queryApproverDirectory()
            if (!result.data) throw new Error("approverDirectory answered no data")
            return result.data.approverDirectory
        },
        config,
    )
