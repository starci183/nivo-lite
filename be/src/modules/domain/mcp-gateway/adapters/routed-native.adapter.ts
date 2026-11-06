import type { GatewayJson, NativeAdapter, NativeCaller, NativeConnectorManifest } from "../mcp-gateway.contracts"
import { unknownTool } from "../native-arguments.policy"

/** One tool of a routed connector: runs for a workspace with the arguments the caller gave. */
export type NativeToolHandler = (workspaceId: string, args: GatewayJson) => Promise<GatewayJson>

/**
 * A native connector that routes each tool name to the handler that runs it. A connector declares its manifest and its handlers; the
 * dispatch, and the refusal of a tool it does not have, are written once here.
 */
export abstract class RoutedNativeAdapter implements NativeAdapter {
    /** The manifest. */
    abstract readonly manifest: NativeConnectorManifest

    /** The handler of each tool, by tool name. */
    protected abstract readonly handlers: ReadonlyMap<string, NativeToolHandler>

    /** Runs one tool; a tool the connector does not have is an unknown-tool error. */
    invoke(workspaceId: string, tool: string, args: GatewayJson, _caller: NativeCaller): Promise<GatewayJson> {
        const handler = this.handlers.get(tool)
        if (handler === undefined) return Promise.reject(unknownTool(tool))
        return handler(workspaceId, args)
    }
}
