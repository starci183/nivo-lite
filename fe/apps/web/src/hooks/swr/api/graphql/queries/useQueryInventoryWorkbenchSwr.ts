"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryInventoryWorkbench } from "@/modules/api/graphql/queries/query-inventory-workbench"

/** The SWR key of the `inventoryWorkbench` query. */
export const QUERY_INVENTORY_WORKBENCH_SWR_KEY = "QUERY_INVENTORY_WORKBENCH_SWR"

/** The `inventoryWorkbench` query through SWR. */
export const useQueryInventoryWorkbenchSwr = () =>
    useSWR(useWorkspaceKey(QUERY_INVENTORY_WORKBENCH_SWR_KEY, []), async () => {
        const result = await queryInventoryWorkbench()
        if (!result.data) throw new Error("inventoryWorkbench answered no data")
        return result.data.inventoryWorkbench
    })
