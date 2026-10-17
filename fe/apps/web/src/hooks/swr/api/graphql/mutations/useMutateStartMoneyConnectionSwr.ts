"use client"

import { mutateStartMoneyConnection } from "@/modules/api/graphql/mutations/mutation-start-money-connection"
import type { mutateStartMoneyConnection as MutateStartMoneyConnectionOperation } from "@/modules/api/graphql/mutations/mutation-start-money-connection"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the startMoneyConnection mutation. */
export const MUTATE_START_MONEY_CONNECTION_SWR_KEY = "MUTATE_START_MONEY_CONNECTION_SWR"

/** SWR mutation for {@link mutateStartMoneyConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateStartMoneyConnectionSwr = () =>
    useSWRMutation(
        MUTATE_START_MONEY_CONNECTION_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateStartMoneyConnection({ request: arg }), MUTATE_START_MONEY_CONNECTION_SWR_KEY)
                .startMoneyConnection,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateStartMoneyConnectionOperation>[0]["request"]
}
