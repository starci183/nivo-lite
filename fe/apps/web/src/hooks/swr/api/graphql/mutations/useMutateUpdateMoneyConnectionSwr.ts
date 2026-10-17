"use client"

import { mutateUpdateMoneyConnection } from "@/modules/api/graphql/mutations/mutation-update-money-connection"
import type { mutateUpdateMoneyConnection as MutateUpdateMoneyConnectionOperation } from "@/modules/api/graphql/mutations/mutation-update-money-connection"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the updateMoneyConnection mutation. */
export const MUTATE_UPDATE_MONEY_CONNECTION_SWR_KEY = "MUTATE_UPDATE_MONEY_CONNECTION_SWR"

/** SWR mutation for {@link mutateUpdateMoneyConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateUpdateMoneyConnectionSwr = () =>
    useSWRMutation(
        MUTATE_UPDATE_MONEY_CONNECTION_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateUpdateMoneyConnection({ request: arg }), MUTATE_UPDATE_MONEY_CONNECTION_SWR_KEY)
                .updateMoneyConnection,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateUpdateMoneyConnectionOperation>[0]["request"]
}
