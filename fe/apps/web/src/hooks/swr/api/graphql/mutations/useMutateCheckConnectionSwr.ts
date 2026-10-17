"use client"

import { mutateCheckConnection } from "@/modules/api/graphql/mutations/mutation-check-connection"
import type { mutateCheckConnection as MutateCheckConnectionOperation } from "@/modules/api/graphql/mutations/mutation-check-connection"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the checkConnection mutation. */
export const MUTATE_CHECK_CONNECTION_SWR_KEY = "MUTATE_CHECK_CONNECTION_SWR"

/** SWR mutation for {@link mutateCheckConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateCheckConnectionSwr = () =>
    useSWRMutation(
        MUTATE_CHECK_CONNECTION_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateCheckConnection({ request: arg }), MUTATE_CHECK_CONNECTION_SWR_KEY)
                .checkConnection,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateCheckConnectionOperation>[0]["request"]
}
