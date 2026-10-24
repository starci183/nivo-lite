import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the MCP gateway receipts capability. */
export enum McpGatewayReceiptsErrorCode {
    /** The recorded connector operation is missing or cannot be read safely. */
    Unreadable = "MCP_GATEWAY_RECEIPTS_UNREADABLE",
}

/** How each receipt code travels. */
export const MCP_GATEWAY_RECEIPTS_ERROR_KINDS: Record<McpGatewayReceiptsErrorCode, ErrorKind> = {
    [McpGatewayReceiptsErrorCode.Unreadable]: "internal",
}

/** The one error class of the MCP gateway receipts capability. */
export class McpGatewayReceiptsError extends DomainError<McpGatewayReceiptsErrorCode> {}
