"use client"

import { mutateSetConnectionGrant } from "@/modules/api/graphql/mutations/mutation-set-connection-grant"
import type { mutateSetConnectionGrant as MutateSetConnectionGrantOperation } from "@/modules/api/graphql/mutations/mutation-set-connection-grant"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the setConnectionGrant mutation. */
export const MUTATE_SET_CONNECTION_GRANT_SWR_KEY = "MUTATE_SET_CONNECTION_GRANT_SWR"

/** SWR mutation for {@link mutateSetConnectionGrant}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSetConnectionGrantSwr = () =>
    useSWRMutation(
        MUTATE_SET_CONNECTION_GRANT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSetConnectionGrant({ request: arg }), MUTATE_SET_CONNECTION_GRANT_SWR_KEY)
                .setConnectionGrant,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateSetConnectionGrantOperation>[0]["request"]
}
