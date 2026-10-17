"use client"

import { queryPreviewDatabaseTable } from "@/modules/api/graphql/queries/query-preview-database-table"
import type { queryPreviewDatabaseTable as QueryPreviewDatabaseTableOperation } from "@/modules/api/graphql/queries/query-preview-database-table"
import useSWRMutation from "swr/mutation"

/** The SWR key of the previewDatabaseTable query. */
export const QUERY_PREVIEW_DATABASE_TABLE_SWR_KEY = "QUERY_PREVIEW_DATABASE_TABLE_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: Parameters<typeof QueryPreviewDatabaseTableOperation>[0]["request"]
}

/** Lazily reads the first rows of one mapped table; `trigger(input)` answers the payload and rejects with the back end failure. */
export const useQueryPreviewDatabaseTableSwr = () =>
    useSWRMutation(QUERY_PREVIEW_DATABASE_TABLE_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await queryPreviewDatabaseTable({ request: arg })
        if (!result.data) throw new Error("previewDatabaseTable answered no data")
        return result.data.previewDatabaseTable
    })
