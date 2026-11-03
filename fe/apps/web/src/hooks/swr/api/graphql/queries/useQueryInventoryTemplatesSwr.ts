"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryInventoryTemplates } from "@/modules/api/graphql/queries/query-inventory-templates"
import type { OperationData, ReadResponse } from "@/hooks/workspaceread"

/** The SWR key of the `inventoryTemplates` query. */
export const QUERY_INVENTORY_TEMPLATES_SWR_KEY = "QUERY_INVENTORY_TEMPLATES_SWR"

/** The `inventoryTemplates` query through SWR. */
export const useQueryInventoryTemplatesSwr = (
    isActive = true,
): ReadResponse<OperationData<typeof queryInventoryTemplates>["inventoryTemplates"]> => {
    const key = useWorkspaceKey(QUERY_INVENTORY_TEMPLATES_SWR_KEY, [])
    return useSWR(isActive ? key : null, async () => {
        const result = await queryInventoryTemplates()
        if (!result.data) throw new Error("inventoryTemplates answered no data")
        return result.data.inventoryTemplates
    })
}
