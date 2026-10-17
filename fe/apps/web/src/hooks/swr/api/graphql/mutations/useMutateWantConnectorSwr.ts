"use client"

import { mutateWantConnector } from "@/modules/api/graphql/mutations/mutation-want-connector"
import type { mutateWantConnector as MutateWantConnectorOperation } from "@/modules/api/graphql/mutations/mutation-want-connector"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the wantConnector mutation. */
export const MUTATE_WANT_CONNECTOR_SWR_KEY = "MUTATE_WANT_CONNECTOR_SWR"

/** SWR mutation for {@link mutateWantConnector}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateWantConnectorSwr = () =>
    useSWRMutation(
        MUTATE_WANT_CONNECTOR_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateWantConnector({ request: arg }), MUTATE_WANT_CONNECTOR_SWR_KEY).wantConnector,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateWantConnectorOperation>[0]["request"]
}
