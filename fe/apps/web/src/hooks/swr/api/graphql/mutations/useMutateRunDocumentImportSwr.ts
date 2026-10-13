import useSWRMutation from "swr/mutation"
import { mutateRunDocumentImport } from "@/modules/api/graphql/mutations/mutation-run-document-import"
import type { MutateRunDocumentImportRequest } from "@/modules/api/graphql/mutations/mutation-run-document-import"

/** What the runDocumentImport mutation is triggered with. */
interface RunDocumentImportArg {
    readonly arg: MutateRunDocumentImportRequest
}

/** The SWR key of the runDocumentImport mutation. */
export const MUTATE_RUN_DOCUMENT_IMPORT_SWR_KEY = "MUTATE_RUN_DOCUMENT_IMPORT_SWR"

/** SWR mutation for {@link mutateRunDocumentImport}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRunDocumentImportSwr = () =>
    useSWRMutation(MUTATE_RUN_DOCUMENT_IMPORT_SWR_KEY, async (_key: string, { arg }: RunDocumentImportArg) => {
        const result = await mutateRunDocumentImport({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("runDocumentImport answered no data")
        return result.data.runDocumentImport
    })
