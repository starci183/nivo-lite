"use client"

import useSWR from "swr"
import { queryModulesCatalog } from "@/modules/api/graphql/queries/query-modules-catalog"
import type { OperationData, ReadResponse } from "@/hooks/workspaceread"

/** The authenticated catalogue cache; it contains both product languages. */
export const QUERY_MODULES_CATALOG_SWR_KEY = "QUERY_MODULES_CATALOG_SWR"

/** Reads the catalogue without a workspace scope. Authentication clears the SWR cache. */
export const useQueryModulesCatalogSwr = (): ReadResponse<
    OperationData<typeof queryModulesCatalog>["modulesCatalog"]
> =>
    useSWR(QUERY_MODULES_CATALOG_SWR_KEY, async () => {
        const result = await queryModulesCatalog()
        if (!result.data) throw new Error("modulesCatalog answered no data")
        return result.data.modulesCatalog
    })
