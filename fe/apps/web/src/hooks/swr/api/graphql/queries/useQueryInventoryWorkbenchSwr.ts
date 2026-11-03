"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryInventoryWorkbench } from "@/modules/api/graphql/queries/query-inventory-workbench"
import type { OperationData, ReadResponse } from "@/hooks/workspaceread"

/** The SWR key of the `inventoryWorkbench` query. */
export const QUERY_INVENTORY_WORKBENCH_SWR_KEY = "QUERY_INVENTORY_WORKBENCH_SWR"

/** The `inventoryWorkbench` query through SWR. */
export const useQueryInventoryWorkbenchSwr = (
    isActive = true,
): ReadResponse<OperationData<typeof queryInventoryWorkbench>["inventoryWorkbench"]> => {
    const key = useWorkspaceKey(QUERY_INVENTORY_WORKBENCH_SWR_KEY, [])
    return useSWR(isActive ? key : null, async () => {
        const result = await queryInventoryWorkbench()
        if (!result.data) throw new Error("inventoryWorkbench answered no data")
        return result.data.inventoryWorkbench
    })
}
