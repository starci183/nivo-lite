import type { ToolJson, NativeToolFamily, NativeCaller, ToolManifest } from "../tools.contracts"
import { unknownTool } from "../native-arguments.policy"

/** One tool of a routed connector: runs for a workspace with the arguments the caller gave. */
export type ToolHandler = (workspaceId: string, args: ToolJson) => Promise<ToolJson>

/**
 * A native connector that routes each tool name to the handler that runs it. A connector declares its manifest and its handlers; the
 * dispatch, and the refusal of a tool it does not have, are written once here.
 */
export abstract class RoutedToolFamily implements NativeToolFamily {
    /** The manifest. */
    abstract readonly manifest: ToolManifest

    /** The handler of each tool, by tool name. */
    protected abstract readonly handlers: ReadonlyMap<string, ToolHandler>

    /** Runs one tool; a tool the connector does not have is an unknown-tool error. */
    invoke(workspaceId: string, tool: string, args: ToolJson, _caller: NativeCaller): Promise<ToolJson> {
        const handler = this.handlers.get(tool)
        if (handler === undefined) return Promise.reject(unknownTool(tool))
        return handler(workspaceId, args)
    }
}
