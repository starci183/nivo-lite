"use client"

import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import { answeredData } from "@/hooks/workspaceread"
import { queryContentWorkbench } from "@/modules/api/graphql/queries/query-content-workbench"
import type { OperationData, ReadResponse } from "@/hooks/workspaceread"

/** The SWR key of the contentWorkbench query. */
export const QUERY_CONTENT_WORKBENCH_SWR_KEY = "QUERY_CONTENT_WORKBENCH_SWR"

/** Everything the content workbench shows about the workspace. */
export const useQueryContentWorkbenchSwr = (
    isActive = true,
): ReadResponse<OperationData<typeof queryContentWorkbench>["contentWorkbench"]> =>
    useSWR(
        useWorkspaceParamsKey(QUERY_CONTENT_WORKBENCH_SWR_KEY, isActive ? ([] as const) : null),
        async () => answeredData(await queryContentWorkbench(), QUERY_CONTENT_WORKBENCH_SWR_KEY).contentWorkbench,
    )
