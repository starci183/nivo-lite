import useSWRMutation from "swr/mutation"
import { mutateGrantAgentConnection } from "@/modules/api/graphql/mutations/mutation-grant-agent-connection"
import type { MutateGrantAgentConnectionRequest } from "@/modules/api/graphql/mutations/mutation-grant-agent-connection"

/** What the GrantAgentConnection mutation is triggered with. */
interface GrantAgentConnectionArg {
    readonly arg: MutateGrantAgentConnectionRequest
}

/** The SWR key of {@link useMutateGrantAgentConnectionSwr}. */
export const MUTATE_GRANT_AGENT_CONNECTION_SWR_KEY = "MUTATE_GRANT_AGENT_CONNECTION_SWR"

/** SWR mutation for {@link mutateGrantAgentConnection}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateGrantAgentConnectionSwr = () =>
    useSWRMutation(MUTATE_GRANT_AGENT_CONNECTION_SWR_KEY, async (_key: string, { arg }: GrantAgentConnectionArg) => {
        const result = await mutateGrantAgentConnection({ request: arg })
        if (!result.data) throw new Error("grantAgentConnection answered no data")
        return result.data.grantAgentConnection
    })
