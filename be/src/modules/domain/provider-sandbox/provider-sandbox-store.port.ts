import type { EntityManager } from "typeorm"
import type { SandboxAccount, SandboxCall, SandboxScriptOutcome } from "./provider-sandbox.contracts"

/** The kinds of entry the store keeps for one sandbox account. */
export type SandboxEntryKind = "fixture" | "script" | "call"

/** One entry to keep. */
export interface SandboxEntryInput {
    readonly kind: SandboxEntryKind
    readonly operation: string
    readonly key: string
    readonly body: unknown
    readonly remaining: number | null
}

/** A fixture value found, wrapped so a stored `null` is told apart from "no fixture". */
export interface FoundFixture {
    readonly value: unknown
}

/**
 * The engine store of the provider sandbox: entries of ONE live (not removed) sandbox account. Every read and write names the account and
 * sees nothing of a removed or live one (the real store joins `connections` on `deleted_at IS NULL AND sandbox`).
 */
export interface ProviderSandboxStore {
    /** The account as the sandbox doors read it (id, workspace, provider, flag), or null when the workspace has no such live account. */
    accountOf(workspaceId: string, connectionId: string, manager?: EntityManager): Promise<SandboxAccount | null>
    /** Keeps one entry. */
    keep(account: SandboxAccount, entry: SandboxEntryInput, manager?: EntityManager): Promise<void>
    /**
     * Takes the script the next call of the operation obeys, ATOMICALLY: the newest script of the exact key, else of the empty key, that
     * has calls left; one call is used up (a sticky script, `remaining` null, never runs out). Null when no script names the call.
     */
    takeScript(account: SandboxAccount, operation: string, key: string): Promise<SandboxScriptOutcome | null>
    /** The newest fixture of the exact key, else of the empty key; null when none. */
    fixtureOf(account: SandboxAccount, operation: string, key: string): Promise<FoundFixture | null>
    /** The logged calls, oldest first; of one operation when it is named. */
    calls(account: SandboxAccount, operation?: string): Promise<ReadonlyArray<SandboxCall>>
    /** Forgets the fixtures and scripts (the call log stays: it is the evidence). */
    clearPlan(account: SandboxAccount): Promise<void>
}
