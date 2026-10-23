"use client"

import useSWRMutation from "swr/mutation"
import { mutateSetMcpConnectorCredential } from "@/modules/api/graphql/mutations/mutation-set-mcp-connector-credential"
import type { MutateSetMcpConnectorCredentialRequest } from "@/modules/api/graphql/mutations/mutation-set-mcp-connector-credential"

/** What the SetMcpConnectorCredential mutation is triggered with. */
interface SetMcpConnectorCredentialArg {
    readonly arg: MutateSetMcpConnectorCredentialRequest
}

/** The SWR key of {@link useMutateSetMcpConnectorCredentialSwr}. */
export const MUTATE_SET_MCP_CONNECTOR_CREDENTIAL_SWR_KEY = "MUTATE_SET_MCP_CONNECTOR_CREDENTIAL_SWR"

/** SWR mutation for {@link mutateSetMcpConnectorCredential}: `trigger(input)` sets or rotates the sealed credential and answers the tool count; rejects with the back end failure. */
export const useMutateSetMcpConnectorCredentialSwr = () =>
    useSWRMutation(
        MUTATE_SET_MCP_CONNECTOR_CREDENTIAL_SWR_KEY,
        async (_key: string, { arg }: SetMcpConnectorCredentialArg) => {
            const result = await mutateSetMcpConnectorCredential({ request: arg })
            if (!result.data) throw new Error("setMcpConnectorCredential answered no data")
            return result.data.setMcpConnectorCredential
        },
    )
