"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateCheckMcpConnector,
    type MutateCheckMcpConnectorRequest,
} from "@/modules/api/graphql/mutations/mutation-check-mcp-connector"
import type { CheckMcpConnectorMutation } from "@/modules/api"

/** What the CheckMcpConnector mutation is triggered with. */
interface CheckMcpConnectorArg {
    readonly arg: MutateCheckMcpConnectorRequest
}

/** The SWR key of {@link useMutateCheckMcpConnectorSwr}. */
export const MUTATE_CHECK_MCP_CONNECTOR_SWR_KEY = "MUTATE_CHECK_MCP_CONNECTOR_SWR"

/** SWR mutation for {@link mutateCheckMcpConnector}: `trigger({ key })` answers the recorded status and rejects with the back end failure. */
export const useMutateCheckMcpConnectorSwr = (): SWRMutationResponse<
    CheckMcpConnectorMutation["checkMcpConnector"],
    Error,
    typeof MUTATE_CHECK_MCP_CONNECTOR_SWR_KEY,
    CheckMcpConnectorArg["arg"]
> =>
    useSWRMutation(MUTATE_CHECK_MCP_CONNECTOR_SWR_KEY, async (_key: string, { arg }: CheckMcpConnectorArg) => {
        const result = await mutateCheckMcpConnector({ request: arg })
        if (!result.data) throw new Error("checkMcpConnector answered no data")
        return result.data.checkMcpConnector
    })
