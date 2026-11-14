/*
 * THE PROVIDER SANDBOX (owner ruling R56, lane concept provider-sandbox): a provider ACCOUNT flagged `sandbox` is answered by its
 * provider's second implementation of the same port, from this engine store of fixtures, scripted outcomes and a call log. The engine
 * knows "sandbox account" only: an operation and a key are opaque words its provider chooses; nothing here names a provider.
 */

/**
 * The account a sandbox door is asked about: the connection's id, workspace, provider key and its creation-time flag. Anything but
 * `sandbox: true` is a live account and every door refuses it. (SBX: `sandbox` is optional only until `ConnectionRecord.sandbox` lands
 * after RESTART-R4; it then becomes required.)
 */
export interface SandboxAccount {
    readonly id: string
    readonly workspaceId: string
    readonly provider: string
    readonly sandbox?: boolean | undefined
}

/**
 * The generic failures a script can name. Each provider maps a kind to the SAME error its live implementation throws for that case:
 * `refused` = the provider answered no, for the reason word (`insufficient_balance`, `domain_locked`, `rejected`, `outside_window`);
 * `unavailable` = a 5xx, nothing done; `timeout` = no answer, the effect is not known; `auth_expired` = the credential is refused;
 * `not_found` = the thing asked for is not there.
 */
export const SANDBOX_FAILURE_KINDS = ["refused", "unavailable", "timeout", "auth_expired", "not_found"] as const

/** One generic failure kind. */
export type SandboxFailureKind = (typeof SANDBOX_FAILURE_KINDS)[number]

/** A scripted failure: its kind, the provider's reason word (a `refused` names one) and an optional readable detail. */
export interface SandboxFailure {
    readonly kind: SandboxFailureKind
    readonly reason?: string | undefined
    readonly detail?: string | undefined
}

/** What a script makes the next call(s) of one operation do: answer a value, or fail. */
export type SandboxScriptOutcome =
    | { readonly outcome: "answer"; readonly value: unknown }
    | { readonly outcome: "fail"; readonly failure: SandboxFailure }

/** What a call came to, as the call log keeps it. */
export type SandboxCallOutcome =
    | { readonly outcome: "answered"; readonly by: "script" | "fixture" | "default"; readonly value: unknown }
    | { readonly outcome: "failed"; readonly failure: SandboxFailure }
    /** The provider's own answer threw (a fixture it refuses, a request it judges): the error's code, else its name. */
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

/** A fixture to keep: the answer of one operation for one key (`''` = any key of the operation). */
export interface SandboxFixtureInput {
    readonly operation: string
    readonly key?: string | undefined
    readonly value: unknown
}

/** A script to keep: what the next `times` calls of one operation do (absent: every call until another script or a clear). */
export interface SandboxScriptInput {
    readonly operation: string
    readonly key?: string | undefined
    readonly script: SandboxScriptOutcome
    readonly times?: number | undefined
}

/**
 * How a provider's sandbox implementation answers one call: the opaque key of the request (a domain name, an op + params digest), the
 * default answer when neither a script nor a fixture names the call (a fixture value is handed to it, null when there is none), and the
 * provider's mapping of a scripted failure to the error its live implementation throws.
 */
export interface SandboxCallPlan<Answer> {
    readonly key?: string | undefined
    answer(fixture: unknown): Answer | Promise<Answer>
    fail(failure: SandboxFailure): Error
}
