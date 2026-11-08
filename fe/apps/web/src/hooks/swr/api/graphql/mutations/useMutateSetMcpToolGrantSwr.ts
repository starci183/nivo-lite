"use client"

import {
    mutateSetMcpToolGrant,
    type mutateSetMcpToolGrant as MutateSetMcpToolGrantOperation,
} from "@/modules/api/graphql/mutations/mutation-set-mcp-tool-grant"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { SetMcpToolGrantMutation } from "@/modules/api"

/** The SWR key of the setMcpToolGrant mutation. */
export const MUTATE_SET_MCP_TOOL_GRANT_SWR_KEY = "MUTATE_SET_MCP_TOOL_GRANT_SWR"

/** SWR mutation for {@link mutateSetMcpToolGrant}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSetMcpToolGrantSwr = (): SWRMutationResponse<
    SetMcpToolGrantMutation["setMcpToolGrant"],
    Error,
    typeof MUTATE_SET_MCP_TOOL_GRANT_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_SET_MCP_TOOL_GRANT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSetMcpToolGrant({ request: arg }), MUTATE_SET_MCP_TOOL_GRANT_SWR_KEY)
                .setMcpToolGrant,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateSetMcpToolGrantOperation>[0]["request"]
}
