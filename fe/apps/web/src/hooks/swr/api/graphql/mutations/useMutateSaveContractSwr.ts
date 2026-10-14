"use client"

import useSWRMutation from "swr/mutation"
import { mutateSaveContract } from "@/modules/api/graphql/mutations/mutation-save-contract"
import type { MutateSaveContractRequest } from "@/modules/api/graphql/mutations/mutation-save-contract"

/** What the saveContract mutation is triggered with. */
interface SaveContractArg {
    readonly arg: MutateSaveContractRequest
}

/** The SWR key of the saveContract mutation. */
export const MUTATE_SAVE_CONTRACT_SWR_KEY = "MUTATE_SAVE_CONTRACT_SWR"

/** SWR mutation for {@link mutateSaveContract}: `trigger(request)` answers the result and rejects with the back end failure. */
export const useMutateSaveContractSwr = () =>
    useSWRMutation(MUTATE_SAVE_CONTRACT_SWR_KEY, async (_key: string, { arg }: SaveContractArg) => {
        const result = await mutateSaveContract({ request: arg })
        if (!result.data) throw new Error("saveContract answered no data")
        return result.data.saveContract
    })
