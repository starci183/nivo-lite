"use client"

import useSWRMutation from "swr/mutation"
import { mutateApproveMcpConnector } from "@/modules/api/graphql/mutations/mutation-approve-mcp-connector"
import type { MutateApproveMcpConnectorRequest } from "@/modules/api/graphql/mutations/mutation-approve-mcp-connector"

/** What the ApproveMcpConnector mutation is triggered with. */
interface ApproveMcpConnectorArg {
    readonly arg: MutateApproveMcpConnectorRequest
}

/** The SWR key of {@link useMutateApproveMcpConnectorSwr}. */
export const MUTATE_APPROVE_MCP_CONNECTOR_SWR_KEY = "MUTATE_APPROVE_MCP_CONNECTOR_SWR"

/** SWR mutation for {@link mutateApproveMcpConnector}: `trigger({ key })` answers the approved tool count and rejects with the back end failure. */
export const useMutateApproveMcpConnectorSwr = () =>
    useSWRMutation(MUTATE_APPROVE_MCP_CONNECTOR_SWR_KEY, async (_key: string, { arg }: ApproveMcpConnectorArg) => {
        const result = await mutateApproveMcpConnector({ request: arg })
        if (!result.data) throw new Error("approveMcpConnector answered no data")
        return result.data.approveMcpConnector
    })
