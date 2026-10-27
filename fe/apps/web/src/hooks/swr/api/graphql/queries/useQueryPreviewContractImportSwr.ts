"use client"

import { queryPreviewContractImport } from "@/modules/api/graphql/queries/query-preview-contract-import"
import type { QueryPreviewContractImportRequest } from "@/modules/api/graphql/queries/query-preview-contract-import"
import useSWRMutation from "swr/mutation"

/** The SWR key of the previewContractImport query. */
export const QUERY_PREVIEW_CONTRACT_IMPORT_SWR_KEY = "QUERY_PREVIEW_CONTRACT_IMPORT_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: QueryPreviewContractImportRequest
}

/** Lazily previews a contract sheet; `trigger(input)` answers the payload and rejects with the back end failure. */
export const useQueryPreviewContractImportSwr = () =>
    useSWRMutation(QUERY_PREVIEW_CONTRACT_IMPORT_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await queryPreviewContractImport({ request: arg })
        if (!result.data) throw new Error("previewContractImport answered no data")
        return result.data.previewContractImport
    })
