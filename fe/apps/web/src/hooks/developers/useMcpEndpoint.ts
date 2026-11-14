"use client"

import { isManager, useMember } from "@/hooks/member"
import { useWorkspaceId } from "@/hooks/workspaces"
import { useQueryApiKeysSwr } from "@/hooks/swr"
import { mcpEndpointStateOf, type McpEndpointState } from "./developers.shared"

/** The MCP address of the active workspace as the API publishes it (`endpointUrl` of its MCP keys); never built on the client. */
export const useMcpEndpoint = (): { readonly state: McpEndpointState; readonly isLoading: boolean } => {
    const workspaceId = useWorkspaceId()
    const keys = useQueryApiKeysSwr(isManager(useMember()) ? workspaceId : undefined)
    return { state: mcpEndpointStateOf(keys.data ?? []), isLoading: keys.isLoading }
}
