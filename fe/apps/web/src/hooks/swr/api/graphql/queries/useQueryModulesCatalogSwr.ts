"use client"

import useSWR from "swr"
import type { SWRResponse } from "swr"
import { queryModulesCatalog } from "@/modules/api/graphql/queries/query-modules-catalog"
import type { ModulesCatalogQuery } from "@/modules/api"

/** The authenticated catalogue cache; it contains both product languages. */
export const QUERY_MODULES_CATALOG_SWR_KEY = "QUERY_MODULES_CATALOG_SWR"

/** Reads the catalogue without a workspace scope. Authentication clears the SWR cache. */
export const useQueryModulesCatalogSwr = (): SWRResponse<ModulesCatalogQuery["modulesCatalog"], Error> =>
    useSWR(QUERY_MODULES_CATALOG_SWR_KEY, async () => {
        const result = await queryModulesCatalog()
        if (!result.data) throw new Error("modulesCatalog answered no data")
        return result.data.modulesCatalog
    })
