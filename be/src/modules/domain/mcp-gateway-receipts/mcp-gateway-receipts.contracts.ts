/** A JSON object carried by a gateway operation receipt. */
export interface GatewayJson {
    /** Any member. */
    readonly [member: string]: unknown
}

/** Why a gateway operation needs a person's approval. */
export type GatewayApprovalReason = "ask_mode" | "over_constraint" | "over_limit_vnd" | "no_rule" | "tainted_input"

/** Why a gateway operation did not produce a result. */
export type GatewayFailure =
    | "invalid_arguments"
    | "invalid_name"
    | "unknown_tool"
    | "connector_disabled"
    | "schema_unapproved"
    | "not_granted"
    | "idempotency_key_required"
    | "internal_only"
    | "unavailable"
    | "tool_error"
    | "unknown_outcome"

/** The completed or pending outcome a gateway receipt keeps sealed. */
export type GatewayCallResult =
    | { readonly ok: true; readonly value: GatewayJson }
    | { readonly ok: false; readonly code: "approval_required"; readonly reason: GatewayApprovalReason }
    | { readonly ok: false; readonly code: GatewayFailure; readonly detail: string }

/** The connector operation invoked by the winner of a durable receipt claim. */
export type GatewayReceiptOperation = () => Promise<GatewayCallResult>
