import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the customer-turns capability. */
export enum CustomerTurnsErrorCode {
    /** The public api origin the agents' tool calls go to is not https (http only for a loopback host); the api refuses to boot. */
    ToolsUrlInvalid = "CUSTOMER_TURNS_TOOLS_URL_INVALID",
}

/** How each customer-turns code travels. */
export const CUSTOMER_TURNS_ERROR_KINDS: Record<CustomerTurnsErrorCode, ErrorKind> = {
    [CustomerTurnsErrorCode.ToolsUrlInvalid]: "internal",
}

/** The one error class of the customer-turns capability. */
export class CustomerTurnsError extends DomainError<CustomerTurnsErrorCode> {}
