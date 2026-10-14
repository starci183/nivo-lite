"use client"

import useSWR from "swr"
import { queryInventoryTemplates } from "@/modules/api/graphql/queries/query-inventory-templates"

/** The SWR key of the `inventoryTemplates` query. */
export const QUERY_INVENTORY_TEMPLATES_SWR_KEY = "QUERY_INVENTORY_TEMPLATES_SWR"

/** The `inventoryTemplates` query through SWR. */
export const useQueryInventoryTemplatesSwr = () =>
    useSWR(QUERY_INVENTORY_TEMPLATES_SWR_KEY, async () => {
        const result = await queryInventoryTemplates()
        if (!result.data) throw new Error("inventoryTemplates answered no data")
        return result.data.inventoryTemplates
    })
