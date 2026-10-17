"use client"

import { mutateStartZaloConnection } from "@/modules/api/graphql/mutations/mutation-start-zalo-connection"
import type { mutateStartZaloConnection as MutateStartZaloConnectionOperation } from "@/modules/api/graphql/mutations/mutation-start-zalo-connection"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the startZaloConnection mutation. */
export const MUTATE_START_ZALO_CONNECTION_SWR_KEY = "MUTATE_START_ZALO_CONNECTION_SWR"

/** SWR mutation for {@link mutateStartZaloConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateStartZaloConnectionSwr = () =>
    useSWRMutation(
        MUTATE_START_ZALO_CONNECTION_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateStartZaloConnection({ request: arg }), MUTATE_START_ZALO_CONNECTION_SWR_KEY)
                .startZaloConnection,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateStartZaloConnectionOperation>[0]["request"]
}
