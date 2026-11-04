"use client"

import {
    mutateRunCsvImport,
    type mutateRunCsvImport as MutateRunCsvImportOperation,
} from "@/modules/api/graphql/mutations/mutation-run-csv-import"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"
import type { SWRMutationResponse } from "swr/mutation"
import type { RunCsvImportMutation } from "@/modules/api"

/** The SWR key of the runCsvImport mutation. */
export const MUTATE_RUN_CSV_IMPORT_SWR_KEY = "MUTATE_RUN_CSV_IMPORT_SWR"

/** SWR mutation for {@link mutateRunCsvImport}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRunCsvImportSwr = (): SWRMutationResponse<
    RunCsvImportMutation["runCsvImport"],
    Error,
    typeof MUTATE_RUN_CSV_IMPORT_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_RUN_CSV_IMPORT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateRunCsvImport({ request: arg }), MUTATE_RUN_CSV_IMPORT_SWR_KEY).runCsvImport,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateRunCsvImportOperation>[0]["request"]
}
