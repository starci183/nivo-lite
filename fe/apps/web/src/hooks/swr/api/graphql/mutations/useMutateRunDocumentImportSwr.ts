"use client"

import {
    mutateRunDocumentImport,
    type mutateRunDocumentImport as MutateRunDocumentImportOperation,
} from "@/modules/api/graphql/mutations/mutation-run-document-import"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"
import type { RunDocumentImportMutation } from "@/modules/api"

/** The SWR key of the runDocumentImport mutation. */
export const MUTATE_RUN_DOCUMENT_IMPORT_SWR_KEY = "MUTATE_RUN_DOCUMENT_IMPORT_SWR"

/** SWR mutation for {@link mutateRunDocumentImport}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRunDocumentImportSwr = (): SWRMutationResponse<
    RunDocumentImportMutation["runDocumentImport"],
    Error,
    typeof MUTATE_RUN_DOCUMENT_IMPORT_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_RUN_DOCUMENT_IMPORT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateRunDocumentImport({ request: arg }), MUTATE_RUN_DOCUMENT_IMPORT_SWR_KEY)
                .runDocumentImport,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateRunDocumentImportOperation>[0]["request"]
}
