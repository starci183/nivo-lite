import useSWRMutation from "swr/mutation"
import { mutateWantConnector } from "@/modules/api/graphql/mutations/mutation-want-connector"
import type { MutateWantConnectorRequest } from "@/modules/api/graphql/mutations/mutation-want-connector"

/** What the wantConnector mutation is triggered with. */
interface WantConnectorArg {
    readonly arg: MutateWantConnectorRequest
}

/** The SWR key of the wantConnector mutation. */
export const MUTATE_WANT_CONNECTOR_SWR_KEY = "MUTATE_WANT_CONNECTOR_SWR"

/** SWR mutation for {@link mutateWantConnector}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateWantConnectorSwr = () =>
    useSWRMutation(MUTATE_WANT_CONNECTOR_SWR_KEY, async (_key: string, { arg }: WantConnectorArg) => {
        const result = await mutateWantConnector({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("wantConnector answered no data")
        return result.data.wantConnector
    })
