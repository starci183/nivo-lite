/** A JSON object carried by a gateway operation receipt. */
export interface ToolJson {
    /** Any member. */
    readonly [member: string]: unknown
}

/** Why a gateway operation needs a person's approval. */
export type ToolApprovalReason =
    "ask_mode" | "outside_write" | "over_constraint" | "over_limit_vnd" | "no_rule" | "tainted_input"

/** Why a gateway operation did not produce a result. */
export type ToolFailure =
    | "invalid_arguments"
    | "invalid_name"
    | "unknown_tool"
    | "not_granted"
    | "idempotency_key_required"
    | "internal_only"
    | "unavailable"
    | "tool_error"
    | "unknown_outcome"

/**
 * What an expected refusal of a tool is, decided where its code is made (a total typed map over the codes of the source): `business`, an
 * answer about the business the caller may read and go on from (`not_found`, `other_lead`); `infrastructure`, something only the engine
 * or a person can cure (`not_connected`, a refused connection, a document that changed). A refusal no source classes is infrastructure.
 */
export type RefusalClass = "business" | "infrastructure"

/**
 * What a connector says of the shape of its answers: `envelope`, every answer is the envelope of the OpenAPI connector
 * (`openapi-response.policy.ts`: `{ ok, status, data, truncated, omitted, notice }` or its refusal), whose body the node door hands a
 * template node apart from the envelope's meta.
 */
export type ManifestAnswers = "envelope"

/** The completed or pending outcome a gateway receipt keeps sealed. */
export type ToolCallResult =
    | {
          readonly ok: true
          readonly value: ToolJson
          readonly summary?: string
          /**
           * `envelope` when the connector that answered declares that every answer of it is the OpenAPI envelope (its manifest's
           * `answers`): set by the gateway AFTER the receipt (never sealed), from the manifest, so a replayed answer is marked alike.
           */
          readonly answers?: ManifestAnswers
      }
    | { readonly ok: false; readonly code: "approval_required"; readonly reason: ToolApprovalReason }
    | {
          readonly ok: false
          readonly code: ToolFailure
          readonly detail: string
          /**
           * The code of a BUSINESS refusal of the tool (`tool_error` only: a native tool's expected refusal its source classes
           * `business`), the fact a template node reads as `{ ok: false, refusal }`; absent for every other failure.
           */
          readonly refused?: string
          /**
           * The typed reason a NATIVE adapter refused the call with (`tool_error` only), whatever its class (`not_connected`,
           * `connection_refused`, `other_lead`, ...): read from the refusal's params where the adapter threw it, never from its words, so
           * a reader decides on it by equality (the node door's "never sent"). Absent for every other
           * failure.
           */
          readonly nativeRefusal?: string
      }

/** The connector operation invoked by the winner of a durable receipt claim. */
export type ToolReceiptOperation = () => Promise<ToolCallResult>
