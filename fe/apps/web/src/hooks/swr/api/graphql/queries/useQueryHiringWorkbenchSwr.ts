"use client"

import useSWR from "swr"
import type { SWRResponse } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryHiringWorkbench } from "@/modules/api/graphql/queries/query-hiring-workbench"
import type { HiringWorkbenchQuery } from "@/modules/api"

/** The SWR key of the `hiringWorkbench` query. */
export const QUERY_HIRING_WORKBENCH_SWR_KEY = "QUERY_HIRING_WORKBENCH_SWR"

/** The `hiringWorkbench` query through SWR. */
export const useQueryHiringWorkbenchSwr = (
    isActive = true,
): SWRResponse<HiringWorkbenchQuery["hiringWorkbench"], Error> =>
    useSWR(useWorkspaceKey(QUERY_HIRING_WORKBENCH_SWR_KEY, [], isActive), async () => {
        const result = await queryHiringWorkbench()
        if (!result.data) throw new Error("hiringWorkbench answered no data")
        return result.data.hiringWorkbench
    })
