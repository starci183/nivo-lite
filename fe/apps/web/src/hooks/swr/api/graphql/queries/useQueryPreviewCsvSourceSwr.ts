"use client"

import {
    queryPreviewCsvSource,
    type queryPreviewCsvSource as QueryPreviewCsvSourceOperation,
} from "@/modules/api/graphql/queries/query-preview-csv-source"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { PreviewCsvSourceQuery } from "@/modules/api"

/** The SWR key of the previewCsvSource query. */
export const QUERY_PREVIEW_CSV_SOURCE_SWR_KEY = "QUERY_PREVIEW_CSV_SOURCE_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: Parameters<typeof QueryPreviewCsvSourceOperation>[0]["request"]
}

/** Lazily previews an import source; `trigger(input)` answers the payload and rejects with the back end failure. */
export const useQueryPreviewCsvSourceSwr = (): SWRMutationResponse<
    PreviewCsvSourceQuery["previewCsvSource"],
    Error,
    typeof QUERY_PREVIEW_CSV_SOURCE_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(QUERY_PREVIEW_CSV_SOURCE_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await queryPreviewCsvSource({ request: arg })
        if (!result.data) throw new Error("previewCsvSource answered no data")
        return result.data.previewCsvSource
    })
