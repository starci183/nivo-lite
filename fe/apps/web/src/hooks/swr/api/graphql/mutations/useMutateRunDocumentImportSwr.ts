import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateRunDocumentImport } from "@/modules/api/graphql/mutations/mutation-run-document-import"

/** The SWR key of the runDocumentImport mutation. */
export const MUTATE_RUN_DOCUMENT_IMPORT_SWR_KEY = "MUTATE_RUN_DOCUMENT_IMPORT_SWR"

/** SWR mutation for {@link mutateRunDocumentImport}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRunDocumentImportSwr = () =>
    useGraphQLMutationSwr(MUTATE_RUN_DOCUMENT_IMPORT_SWR_KEY, mutateRunDocumentImport, (data) => data.runDocumentImport)
