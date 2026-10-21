"use client"

import useSWRMutation from "swr/mutation"
import { mutateCheckMcpConnector } from "@/modules/api/graphql/mutations/mutation-check-mcp-connector"
import type { MutateCheckMcpConnectorRequest } from "@/modules/api/graphql/mutations/mutation-check-mcp-connector"

/** What the CheckMcpConnector mutation is triggered with. */
interface CheckMcpConnectorArg {
    readonly arg: MutateCheckMcpConnectorRequest
}

/** The SWR key of {@link useMutateCheckMcpConnectorSwr}. */
export const MUTATE_CHECK_MCP_CONNECTOR_SWR_KEY = "MUTATE_CHECK_MCP_CONNECTOR_SWR"

/** SWR mutation for {@link mutateCheckMcpConnector}: `trigger({ key })` answers the recorded status and rejects with the back end failure. */
export const useMutateCheckMcpConnectorSwr = () =>
    useSWRMutation(MUTATE_CHECK_MCP_CONNECTOR_SWR_KEY, async (_key: string, { arg }: CheckMcpConnectorArg) => {
        const result = await mutateCheckMcpConnector({ request: arg })
        if (!result.data) throw new Error("checkMcpConnector answered no data")
        return result.data.checkMcpConnector
    })
