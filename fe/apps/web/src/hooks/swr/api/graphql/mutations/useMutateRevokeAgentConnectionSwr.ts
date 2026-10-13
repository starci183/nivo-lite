import useSWRMutation from "swr/mutation"
import { mutateRevokeAgentConnection } from "@/modules/api/graphql/mutations/mutation-revoke-agent-connection"
import type { MutateRevokeAgentConnectionRequest } from "@/modules/api/graphql/mutations/mutation-revoke-agent-connection"

/** What the RevokeAgentConnection mutation is triggered with. */
interface RevokeAgentConnectionArg {
    readonly arg: MutateRevokeAgentConnectionRequest
}

/** The SWR key of {@link useMutateRevokeAgentConnectionSwr}. */
export const MUTATE_REVOKE_AGENT_CONNECTION_SWR_KEY = "MUTATE_REVOKE_AGENT_CONNECTION_SWR"

/** SWR mutation for {@link mutateRevokeAgentConnection}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateRevokeAgentConnectionSwr = () =>
    useSWRMutation(MUTATE_REVOKE_AGENT_CONNECTION_SWR_KEY, async (_key: string, { arg }: RevokeAgentConnectionArg) => {
        const result = await mutateRevokeAgentConnection({ request: arg })
        if (!result.data) throw new Error("revokeAgentConnection answered no data")
        return result.data.revokeAgentConnection
    })
