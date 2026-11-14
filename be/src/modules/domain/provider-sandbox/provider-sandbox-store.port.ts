import type { EntityManager } from "typeorm"
import type { SandboxAccount, SandboxCall, SandboxCallOutcome } from "./provider-sandbox.contracts"

/** One logged call to keep. */
export interface SandboxCallInput {
    readonly operation: string
    readonly key: string
    readonly request: unknown
    readonly result: SandboxCallOutcome
}

/** A kept state value, wrapped so a kept `null` is told apart from "nothing kept". */
export interface KeptState {
    readonly value: unknown
}

/**
 * The engine store of the provider sandbox: the STATE and the call log of ONE live (not removed) sandbox account. Every read and write
 * names the account and sees nothing of a removed or live one (the real store joins `connections` on `deleted_at IS NULL AND sandbox`).
 */
export interface ProviderSandboxStore {
    /** The account as the sandbox doors read it, or null when the workspace has no such live account. */
    accountOf(workspaceId: string, connectionId: string, manager?: EntityManager): Promise<SandboxAccount | null>
    /** The account a webhook route names (any workspace), or null when there is no such live account. */
    accountOfId(connectionId: string, manager?: EntityManager): Promise<SandboxAccount | null>
    /** The newest kept value of (name, key), or null. */
    stateOf(account: SandboxAccount, name: string, key: string): Promise<KeptState | null>
    /** Keeps a value of (name, key). */
    keepState(account: SandboxAccount, name: string, key: string, value: unknown): Promise<void>
    /** Logs one call. */
    logCall(account: SandboxAccount, call: SandboxCallInput): Promise<void>
    /** How many calls of the operation the account took. */
    countCalls(account: SandboxAccount, operation: string): Promise<number>
    /** The logged calls, oldest first; of one operation when it is named. */
    calls(account: SandboxAccount, operation?: string): Promise<ReadonlyArray<SandboxCall>>
    /** Forgets the account's state and call log (a test's `finally`). */
    reset(account: SandboxAccount): Promise<void>
}
