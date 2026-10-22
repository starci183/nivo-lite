"use client"

import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import { answeredData } from "@/hooks/workspaceread"
import { queryContentWorkbench } from "@/modules/api/graphql/queries/query-content-workbench"

/** The SWR key of the contentWorkbench query. */
export const QUERY_CONTENT_WORKBENCH_SWR_KEY = "QUERY_CONTENT_WORKBENCH_SWR"

/** Everything the content workbench shows about the workspace. */
export const useQueryContentWorkbenchSwr = () =>
    useSWR(
        useWorkspaceParamsKey(QUERY_CONTENT_WORKBENCH_SWR_KEY, [] as const),
        async () => answeredData(await queryContentWorkbench(), QUERY_CONTENT_WORKBENCH_SWR_KEY).contentWorkbench,
    )
