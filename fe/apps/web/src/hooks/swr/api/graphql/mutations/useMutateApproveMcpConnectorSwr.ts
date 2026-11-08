"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateApproveMcpConnector,
    type MutateApproveMcpConnectorRequest,
} from "@/modules/api/graphql/mutations/mutation-approve-mcp-connector"
import type { ApproveMcpConnectorMutation } from "@/modules/api"

/** What the ApproveMcpConnector mutation is triggered with. */
interface ApproveMcpConnectorArg {
    readonly arg: MutateApproveMcpConnectorRequest
}

/** The SWR key of {@link useMutateApproveMcpConnectorSwr}. */
export const MUTATE_APPROVE_MCP_CONNECTOR_SWR_KEY = "MUTATE_APPROVE_MCP_CONNECTOR_SWR"

/** SWR mutation for {@link mutateApproveMcpConnector}: `trigger({ key })` answers the approved tool count and rejects with the back end failure. */
export const useMutateApproveMcpConnectorSwr = (): SWRMutationResponse<
    ApproveMcpConnectorMutation["approveMcpConnector"],
    Error,
    typeof MUTATE_APPROVE_MCP_CONNECTOR_SWR_KEY,
    ApproveMcpConnectorArg["arg"]
> =>
    useSWRMutation(MUTATE_APPROVE_MCP_CONNECTOR_SWR_KEY, async (_key: string, { arg }: ApproveMcpConnectorArg) => {
        const result = await mutateApproveMcpConnector({ request: arg })
        if (!result.data) throw new Error("approveMcpConnector answered no data")
        return result.data.approveMcpConnector
    })
