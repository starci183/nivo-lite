/**
 * The tool ids of NIVO, one home: `@nivo-lite/agent-sdk/names`. Re-exported here so the importers of `@nivo-lite/blocks-core` keep one
 * import. Every id reads `nivo.tool.<domain>.<object>.<verb>`; a wrong name is a compile error, an old id resolves to nothing.
 */
export { TOOL } from "@nivo-lite/agent-sdk/names"
export type { ToolId } from "@nivo-lite/agent-sdk/names"
