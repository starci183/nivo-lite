import { McpGatewayError, McpGatewayErrorCode } from "./errors/mcp-gateway.error"
import type { GatewayJson } from "./mcp-gateway.contracts"

/** The error of a tool the connector does not have. */
export const unknownTool = (tool: string): McpGatewayError =>
    new McpGatewayError({ code: McpGatewayErrorCode.UnknownTool, params: { tool } })

/** The error of a call whose arguments do not fit the tool's validator. */
export const invalidArguments = (tool: string): McpGatewayError =>
    new McpGatewayError({ code: McpGatewayErrorCode.InvalidArguments, params: { tool } })

/** What reading the arguments of a call answers: the data when they fit, a failure when they do not. */
export type ArgumentReading<Input> = { readonly success: true; readonly data: Input } | { readonly success: false }

/** A validator of a tool's arguments: what a schema of the capability offers, whatever library built it. */
export interface ArgumentReader<Input> {
    /** Reads the arguments; the data when they fit. */
    safeParse(args: GatewayJson): ArgumentReading<Input>
}

/** The arguments of a call read through the tool's validator; refused as invalid arguments when they do not fit. */
export const argumentsOf = <Input>(tool: string, schema: ArgumentReader<Input>, args: GatewayJson): Input => {
    const parsed = schema.safeParse(args)
    if (!parsed.success) throw invalidArguments(tool)
    return parsed.data
}
