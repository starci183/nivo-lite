/*
 * THE PROVIDER SANDBOX (owner rulings R56, R58, R59, R60, R62; lane concept provider-sandbox): a provider ACCOUNT flagged `sandbox` is answered
 * by its provider's second implementation of the same port, from a HARDCODED catalogue of named cases written next to it (ids
 * `<PROVIDER>-<n>`, identical on every machine), never a real host. The engine keeps per account only the STATE a call changes (a domain
 * renewed, the next case the owner picked) and the call log. It is dev only: one switch. The engine knows "sandbox account"; operations, keys and cases are the provider's.
 */

/** The account a sandbox door is asked about: the connection's id, workspace, provider key and its creation-time flag. */
export interface SandboxAccount {
    readonly id: string
    readonly workspaceId: string
    readonly provider: string
    readonly sandbox: boolean
}

/** What a call came to, as the call log keeps it: the provider's answer, or the error its answer threw (its code, else its name). */
export type SandboxCallOutcome =
    | { readonly outcome: "answered"; readonly value: unknown }
    | { readonly outcome: "threw"; readonly error: string }

/** One logged call of a sandbox implementation. */
export interface SandboxCall {
    readonly id: string
    readonly operation: string
    readonly key: string
    readonly request: unknown
    readonly result: SandboxCallOutcome
    readonly at: string
}

/**
 * The account's sandbox STATE as one call's answer reads and changes it (only what a call must change: a renewal moves the domain's
 * expiry, an issue takes the next invoice number, an inbound case keeps the bank movements it made), by (name, key), how many calls of
 * this operation the account took before this one (a deterministic running number for references), and the account's NEXT CASE for this
 * operation (R62: the outbound case the owner picked on the Sandbox page; null = the provider's default, its success case).
 */
export interface SandboxState {
    /** The calls of this call's operation the account took before it. */
    readonly seq: number
    /** The case the account's selector names for this operation, or null (the provider answers its default, the success case). */
    readonly nextCase: string | null
    /** The kept value of (name, key), or null when the account's state holds none (the catalogue's own value applies). */
    read(name: string, key: string): Promise<unknown>
    /** Keeps a new value of (name, key). */
    write(name: string, key: string, value: unknown): Promise<void>
}

/**
 * How a provider's sandbox implementation answers one call: the key of the request (a domain name, a draft id) and the answer, which
 * reads the account's next case and state, may change the state, and throws the SAME error its live twin throws for a failing case (a
 * case that applies its effect and still fails changes the state first, then throws).
 */
export interface SandboxCallPlan<Answer> {
    readonly key?: string | undefined
    answer(state: SandboxState): Answer | Promise<Answer>
}

/** One value an inbound case takes (R62: `{ content, amount }` for a bank): bank words, never a NIVO word like "order". */
export type SandboxInputValue = string | number

/** The inputs an inbound case is sent with, by field name. */
export type SandboxInput = Readonly<Record<string, SandboxInputValue>>

/** One input field an inbound case declares, for the page's form and the API's check. */
export interface SandboxInputField {
    /** The field name (`content`, `amount`, `text`, `userId`). */
    readonly name: string
    /** What the field is, for the page. */
    readonly label: string
    /** A text, or an integer (VND for an amount). */
    readonly kind: "text" | "integer"
    /** The value the page shows when nothing prefills it. */
    readonly example: SandboxInputValue
}

/** One webhook call an inbound case makes: the body the provider would post and the headers it sends besides its signature (no secret). */
export interface SandboxWebhookEvent {
    readonly body: unknown
    readonly headers?: Readonly<Record<string, string>> | undefined
}

/** What an inbound case is built from besides its inputs: the account, the moment it is sent, and the account's state. */
export interface SandboxInboundContext {
    /** The sandbox account. */
    readonly connectionId: string
    /** The moment of the send (read by the sender, never by a catalogue). */
    readonly at: Date
    /** The account's state (`seq` = the inbound cases the account was sent before this one: running ids). */
    readonly state: SandboxState
}

/**
 * An inbound case (R62): a named TRANSFORMATION of inputs into the webhook payload(s) the provider would post to its OWN route on NIVO
 * for one account. It may keep what it made in the state (a bank movement the poll then lists, the moment of a customer's line).
 */
export interface SandboxInboundCase {
    /** The trigger it feeds (its declaration's name), for the page. */
    readonly trigger: string
    /** The path of the provider's webhook route for one account, e.g. `api/connections/sepay/<id>`. */
    path(connectionId: string): string
    /** The inputs it takes (none for a case that needs none). */
    readonly inputs: ReadonlyArray<SandboxInputField>
    /** The webhook call(s) the case makes, in order (two of the same body for a duplicate delivery). */
    eventsOf(input: SandboxInput, context: SandboxInboundContext): Promise<ReadonlyArray<SandboxWebhookEvent>>
}

/**
 * One named, fixed case of a provider's sandbox: `<PROVIDER>-<n>`, what it proves, and either the outbound operation it answers (picked
 * by the account's NEXT CASE selector; `default` marks the success case answered when nothing is picked: exactly one per operation) or
 * the inbound event it is.
 */
export interface SandboxCase {
    readonly id: string
    readonly label: string
    /** The operation (port method) it answers, when it is an outbound case. */
    readonly operation?: string | undefined
    /** The success case of its operation: answered while the account's selector names nothing. */
    readonly default?: true | undefined
    /** The inbound event it is, when it is one (the page's "send"). */
    readonly inbound?: SandboxInboundCase | undefined
}

/**
 * Where an inbound case's inputs are prefilled from (R62): the operation of the account's call log that IS a request of the agent's (a
 * bank's payment instruction: `transfer`), and how a logged request of it reads as the inputs (`{ content, amount }`).
 */
export interface SandboxPrefill {
    readonly operation: string
    inputOf(request: unknown): SandboxInput | null
}

/** A provider's hardcoded catalogue, registered at boot beside its sandbox implementation. */
export interface SandboxCatalogue {
    readonly provider: string
    readonly cases: ReadonlyArray<SandboxCase>
    /** Where its inbound cases' inputs are prefilled from, when the provider takes requests of the agent's (a payment instruction). */
    readonly prefill?: SandboxPrefill | undefined
}

/** The request an agent last made of a sandbox account, read as an inbound case's inputs (R62 "latest payment request"). */
export interface SandboxLatestRequest {
    readonly operation: string
    readonly input: SandboxInput
    readonly at: string
}

/** The dev switch (R60): read once from the environment; off in production. */
export interface ProviderSandboxSwitch {
    readonly enabled: boolean
}
