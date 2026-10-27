"use client"

import useSWRMutation from "swr/mutation"
import { mutateImportContracts } from "@/modules/api/graphql/mutations/mutation-import-contracts"
import type { MutateImportContractsRequest } from "@/modules/api/graphql/mutations/mutation-import-contracts"

/** What the importContracts mutation is triggered with. */
interface ImportContractsArg {
    readonly arg: MutateImportContractsRequest
}

/** The SWR key of the importContracts mutation. */
export const MUTATE_IMPORT_CONTRACTS_SWR_KEY = "MUTATE_IMPORT_CONTRACTS_SWR"

/** SWR mutation for {@link mutateImportContracts}: `trigger(request)` answers how many were saved and which rows were skipped. */
export const useMutateImportContractsSwr = () =>
    useSWRMutation(MUTATE_IMPORT_CONTRACTS_SWR_KEY, async (_key: string, { arg }: ImportContractsArg) => {
        const result = await mutateImportContracts({ request: arg })
        if (!result.data) throw new Error("importContracts answered no data")
        return result.data.importContracts
    })
