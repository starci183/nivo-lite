"use client"

import useSWR from "swr"
import { answeredData } from "@/hooks/workspaceread"
import type { SWRResponse } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryInventoryWorkbench } from "@/modules/api/graphql/queries/query-inventory-workbench"
import type { InventoryWorkbenchQuery } from "@/modules/api"

/** The SWR key of the `inventoryWorkbench` query. */
export const QUERY_INVENTORY_WORKBENCH_SWR_KEY = "QUERY_INVENTORY_WORKBENCH_SWR"

/** The `inventoryWorkbench` query through SWR. */
export const useQueryInventoryWorkbenchSwr = (
    isActive = true,
): SWRResponse<InventoryWorkbenchQuery["inventoryWorkbench"], Error> => {
    const key = useWorkspaceKey(QUERY_INVENTORY_WORKBENCH_SWR_KEY, [])
    return useSWR(
        isActive ? key : null,
        async () => answeredData(await queryInventoryWorkbench(), "inventoryWorkbench").inventoryWorkbench,
    )
}
