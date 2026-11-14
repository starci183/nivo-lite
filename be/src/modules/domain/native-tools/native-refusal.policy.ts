import { ToolsError, ToolsErrorCode, type RefusalClass } from "@modules/domain/tools"

/** The expected refusals of a native tool: an answer to the caller, never a failure of the connector. */
export type NativeRefusalReason =
    | "not_connected"
    | "not_found"
    | "internal_only"
    | "connection_refused"
    | "ledger_key_unavailable"
    | "other_conversation"
    | "other_lead"
    | "other_contact"
    | "contact_missing"
    | "identity_invalid"
    | "identity_taken"
    | "token_invalid"
    | "account_missing"
    | "same_contact"
    | "no_proof"
    | "reason_missing"
    | "quote_not_said"
    | "not_served"
    | "not_selected"
    | "customer_not_linked"
    | "other_customer"
    | "ask_only"
    | "document_unpinned"
    | "document_changed"
    | "crm_op_missing"
    | "operation_unsupported"
    | "operation_mode_mismatch"
    | "host_not_allowed"
    | "response_mismatch"
    | "response_undeclared"
    | "response_not_json"

/**
 * What each expected refusal of a native tool IS, decided here where the codes are made (a TOTAL record: a reason without a class does
 * not compile). `business`: an answer about the records the caller may read and go on from; a template node receives it as
 * `{ ok: false, refusal, facts }`. `infrastructure`: what only the engine or a person can cure (a connection, the app's wiring, a
 * pinned document, a right, a malformed call); the step freezes and is reported, as before. When unsure: infrastructure.
 */
export const NATIVE_REFUSAL_CLASS: Readonly<Record<NativeRefusalReason, RefusalClass>> = {
    // No account of the provider is connected: the owner connects one (ruled infrastructure).
    not_connected: "infrastructure",
    // The record the call names does not exist (or not for this workspace): a fact about the business.
    not_found: "business",
    // The tool serves internal callers only and this run speaks to a customer: an audience right, which only the setup cures.
    internal_only: "infrastructure",
    // The provider refused the workspace's connection (401 / 403): only the owner can cure it.
    connection_refused: "infrastructure",
    // The ledger that keys the write is not bound in this app: the engine's wiring.
    ledger_key_unavailable: "infrastructure",
    // The call names a conversation other than the run's own: the record is another's, a fact the caller reads.
    other_conversation: "business",
    // The record belongs to another customer than the run's: a fact the caller reads.
    other_lead: "business",
    // The call names a contact other than the person the run serves: a fact the caller reads.
    other_contact: "business",
    // The contact the call names is not one of the workspace (unknown, merged away into one it names, erased): a fact.
    contact_missing: "business",
    // The identifier cannot be written in its one canonical form (no phone, no mail address): the call's own facts, answered.
    identity_invalid: "business",
    // A verified channel or outside identity another contact holds: a fact; moving it is a person's merge.
    identity_taken: "business",
    // The link token is unknown, used or expired: a fact about what the person presented.
    token_invalid: "business",
    // The outside identity names an account the workspace does not hold: a fact about the call.
    account_missing: "business",
    // A contact merged with itself: the store's integrity, answered.
    same_contact: "business",
    // A merge no person decided: the node's declared mode asks a person; the AI reports it.
    no_proof: "business",
    // A proposed change came without its reason: a malformed call (a missing argument is a bug).
    reason_missing: "infrastructure",
    // The quote a proposed change rests on was never said in the conversation: the tool's own rule about the facts, answered.
    quote_not_said: "business",
    // This app serves no such capability (no engine, link store, client bound): the app's wiring.
    not_served: "infrastructure",
    // No single account or operation is selected (several candidates, a name of another source): setup, not business.
    not_selected: "infrastructure",
    // The conversation is linked to no customer of the outside system: a fact about the business.
    customer_not_linked: "business",
    // The call names a customer other than the one the conversation is linked to: a fact the caller reads.
    other_customer: "business",
    // The operation may run only with a person's approval and came without one: a right.
    ask_only: "infrastructure",
    // The account pins no document of the outside system: the owner pins one.
    document_unpinned: "infrastructure",
    // The outside system's document changed since it was pinned: the owner pins it again.
    document_changed: "infrastructure",
    // The pinned document has no such operation: the setup.
    crm_op_missing: "infrastructure",
    // The operation uses what the provider cannot call: the setup.
    operation_unsupported: "infrastructure",
    // A read declared on an operation that writes: the setup.
    operation_mode_mismatch: "infrastructure",
    // The outside system's address may not be called: the setup.
    host_not_allowed: "infrastructure",
    // The outside system answered what its document does not declare: the outside system is broken.
    response_mismatch: "infrastructure",
    response_undeclared: "infrastructure",
    response_not_json: "infrastructure",
}

/** The params a native refusal is thrown with. */
export type NativeRefusalParams = {
    /** Why the call was refused. */
    readonly reason: string
    /** The class of the refusal. */
    readonly refusalClass: RefusalClass
}

/** The params a native refusal is thrown with: its reason and its class, read by the gateway where the refusal becomes an answer. */
export const nativeRefusalParamsOf = (reason: NativeRefusalReason): NativeRefusalParams => ({
    reason,
    refusalClass: NATIVE_REFUSAL_CLASS[reason],
})

/**
 * The refusal a native tool throws for an expected case; the gateway turns it into a `tool_error` answer. The failure that led to it,
 * when there was one, rides as its cause.
 */
export const nativeRefusal = (reason: NativeRefusalReason, cause?: unknown): ToolsError =>
    new ToolsError({
        code: ToolsErrorCode.NativeRefused,
        params: nativeRefusalParamsOf(reason),
        ...(cause === undefined ? {} : { cause }),
    })
