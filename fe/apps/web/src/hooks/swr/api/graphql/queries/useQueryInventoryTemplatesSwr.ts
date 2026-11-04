"use client"

import useSWR from "swr"
import { answeredData } from "@/hooks/workspaceread"
import type { SWRResponse } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryInventoryTemplates } from "@/modules/api/graphql/queries/query-inventory-templates"
import type { InventoryTemplatesQuery } from "@/modules/api"

/** The SWR key of the `inventoryTemplates` query. */
export const QUERY_INVENTORY_TEMPLATES_SWR_KEY = "QUERY_INVENTORY_TEMPLATES_SWR"

/** The `inventoryTemplates` query through SWR. */
export const useQueryInventoryTemplatesSwr = (
    isActive = true,
): SWRResponse<InventoryTemplatesQuery["inventoryTemplates"], Error> => {
    const key = useWorkspaceKey(QUERY_INVENTORY_TEMPLATES_SWR_KEY, [])
    return useSWR(
        isActive ? key : null,
        async () => answeredData(await queryInventoryTemplates(), "inventoryTemplates").inventoryTemplates,
    )
}
