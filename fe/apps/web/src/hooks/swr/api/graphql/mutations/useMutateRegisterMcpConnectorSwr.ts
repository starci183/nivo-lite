"use client"

import useSWRMutation from "swr/mutation"
import { mutateRegisterMcpConnector } from "@/modules/api/graphql/mutations/mutation-register-mcp-connector"
import type { MutateRegisterMcpConnectorRequest } from "@/modules/api/graphql/mutations/mutation-register-mcp-connector"

/** What the RegisterMcpConnector mutation is triggered with. */
interface RegisterMcpConnectorArg {
    readonly arg: MutateRegisterMcpConnectorRequest
}

/** The SWR key of {@link useMutateRegisterMcpConnectorSwr}. */
export const MUTATE_REGISTER_MCP_CONNECTOR_SWR_KEY = "MUTATE_REGISTER_MCP_CONNECTOR_SWR"

/** SWR mutation for {@link mutateRegisterMcpConnector}: `trigger(input)` registers a remote connector with its credential and answers true; rejects with the back end failure. */
export const useMutateRegisterMcpConnectorSwr = () =>
    useSWRMutation(MUTATE_REGISTER_MCP_CONNECTOR_SWR_KEY, async (_key: string, { arg }: RegisterMcpConnectorArg) => {
        const result = await mutateRegisterMcpConnector({ request: arg })
        if (!result.data) throw new Error("registerMcpConnector answered no data")
        return result.data.registerMcpConnector
    })
