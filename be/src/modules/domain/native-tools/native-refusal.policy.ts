import { McpGatewayError, McpGatewayErrorCode } from "@modules/domain/mcp-gateway"

/** The expected refusals of a native tool: an answer to the caller, never a failure of the connector. */
export type NativeRefusalReason = "not_connected" | "not_found" | "internal_only" | "connection_refused"

/**
 * The refusal a native tool throws for an expected case; the gateway turns it into a `tool_error` answer. The failure that led to it,
 * when there was one, rides as its cause.
 */
export const nativeRefusal = (reason: NativeRefusalReason, cause?: unknown): McpGatewayError =>
    new McpGatewayError({
        code: McpGatewayErrorCode.NativeRefused,
        params: { reason },
        ...(cause === undefined ? {} : { cause }),
    })
