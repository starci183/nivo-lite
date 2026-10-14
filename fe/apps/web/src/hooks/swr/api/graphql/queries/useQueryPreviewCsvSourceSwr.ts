"use client"

import useSWRMutation from "swr/mutation"
import { queryPreviewCsvSource } from "@/modules/api/graphql/queries/query-preview-csv-source"

/** The SWR key of the previewCsvSource query. */
export const QUERY_PREVIEW_CSV_SOURCE_SWR_KEY = "QUERY_PREVIEW_CSV_SOURCE_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: Parameters<typeof queryPreviewCsvSource>[0]["request"]
}

/** Lazily previews an import source; `trigger(input)` answers the payload and rejects with the back end failure. */
export const useQueryPreviewCsvSourceSwr = () =>
    useSWRMutation(QUERY_PREVIEW_CSV_SOURCE_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await queryPreviewCsvSource({ request: arg })
        if (!result.data) throw new Error("previewCsvSource answered no data")
        return result.data.previewCsvSource
    })
