import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateRunCsvImport } from "@/modules/api/graphql/mutations/mutation-run-csv-import"

/** The SWR key of the runCsvImport mutation. */
export const MUTATE_RUN_CSV_IMPORT_SWR_KEY = "MUTATE_RUN_CSV_IMPORT_SWR"

/** SWR mutation for {@link mutateRunCsvImport}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRunCsvImportSwr = () =>
    useGraphQLMutationSwr(MUTATE_RUN_CSV_IMPORT_SWR_KEY, mutateRunCsvImport, (data) => data.runCsvImport)
