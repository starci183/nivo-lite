"use client"

import { mutateRunDocumentImport } from "@/modules/api/graphql/mutations/mutation-run-document-import"
import type { mutateRunDocumentImport as MutateRunDocumentImportOperation } from "@/modules/api/graphql/mutations/mutation-run-document-import"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the runDocumentImport mutation. */
export const MUTATE_RUN_DOCUMENT_IMPORT_SWR_KEY = "MUTATE_RUN_DOCUMENT_IMPORT_SWR"

/** SWR mutation for {@link mutateRunDocumentImport}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRunDocumentImportSwr = () =>
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
