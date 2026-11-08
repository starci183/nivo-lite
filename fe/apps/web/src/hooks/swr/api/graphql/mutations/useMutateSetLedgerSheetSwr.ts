"use client"

import {
    mutateSetLedgerSheet,
    type mutateSetLedgerSheet as MutateSetLedgerSheetOperation,
} from "@/modules/api/graphql/mutations/mutation-set-ledger-sheet"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { SetLedgerSheetMutation } from "@/modules/api"

/** The SWR key of the setLedgerSheet mutation. */
export const MUTATE_SET_LEDGER_SHEET_SWR_KEY = "MUTATE_SET_LEDGER_SHEET_SWR"

/** SWR mutation for {@link mutateSetLedgerSheet}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSetLedgerSheetSwr = (): SWRMutationResponse<
    SetLedgerSheetMutation["setLedgerSheet"],
    Error,
    typeof MUTATE_SET_LEDGER_SHEET_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_SET_LEDGER_SHEET_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSetLedgerSheet({ request: arg }), MUTATE_SET_LEDGER_SHEET_SWR_KEY).setLedgerSheet,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateSetLedgerSheetOperation>[0]["request"]
}
