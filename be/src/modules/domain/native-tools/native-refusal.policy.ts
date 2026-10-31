import { McpGatewayError, McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import type { GatewayJson } from "@modules/domain/mcp-gateway"

/** The expected refusals of a native tool: an answer to the caller, never a failure of the connector. */
export type NativeRefusalReason = "not_connected" | "not_found" | "internal_only"

/** The refusal a native tool throws for an expected case; the gateway turns it into a `tool_error` answer. */
export const nativeRefusal = (reason: NativeRefusalReason): McpGatewayError =>
    new McpGatewayError({ code: McpGatewayErrorCode.NativeRefused, params: { reason } })

/** The error of a tool the connector does not have. */
export const unknownTool = (tool: string): McpGatewayError =>
    new McpGatewayError({ code: McpGatewayErrorCode.UnknownTool, params: { tool } })

/** A validator of a tool's arguments: what a schema of the capability offers, whatever library built it. */
export interface ArgumentReader<Input> {
    /** Reads the arguments; the data when they fit. */
    safeParse(args: GatewayJson): { readonly success: true; readonly data: Input } | { readonly success: false }
}

/** The arguments of a call read through the tool's validator; refused as invalid arguments when they do not fit. */
export const argumentsOf = <Input>(tool: string, schema: ArgumentReader<Input>, args: GatewayJson): Input => {
    const parsed = schema.safeParse(args)
    if (!parsed.success) {
        throw new McpGatewayError({ code: McpGatewayErrorCode.InvalidArguments, params: { tool } })
    }
    return parsed.data
}
