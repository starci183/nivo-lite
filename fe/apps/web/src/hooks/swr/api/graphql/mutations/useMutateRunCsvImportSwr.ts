import useSWRMutation from "swr/mutation"
import { mutateRunCsvImport } from "@/modules/api/graphql/mutations/mutation-run-csv-import"
import type { MutateRunCsvImportRequest } from "@/modules/api/graphql/mutations/mutation-run-csv-import"

/** What the runCsvImport mutation is triggered with. */
interface RunCsvImportArg {
    readonly arg: MutateRunCsvImportRequest
}

/** The SWR key of the runCsvImport mutation. */
export const MUTATE_RUN_CSV_IMPORT_SWR_KEY = "MUTATE_RUN_CSV_IMPORT_SWR"

/** SWR mutation for {@link mutateRunCsvImport}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRunCsvImportSwr = () =>
    useSWRMutation(MUTATE_RUN_CSV_IMPORT_SWR_KEY, async (_key: string, { arg }: RunCsvImportArg) => {
        const result = await mutateRunCsvImport({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("runCsvImport answered no data")
        return result.data.runCsvImport
    })
