import type {
    FoundFixture,
    ProviderSandboxStore,
    SandboxAccount,
    SandboxCall,
    SandboxEntryInput,
    SandboxScriptOutcome,
} from "@modules/domain/provider-sandbox"
import { ProviderSandboxService } from "@modules/domain/provider-sandbox"

/** One kept entry of the memory store, in insertion order. */
interface MemoryEntry extends SandboxEntryInput {
    readonly id: string
    readonly workspaceId: string
    readonly connectionId: string
    readonly at: string
    remainingLeft: number | null
}

/** A fixed clock start for the log's times (deterministic). */
const START = Date.UTC(2026, 10, 14, 12, 0, 0)

/**
 * The provider sandbox store in memory, with the SAME rules as the database one: entries of a live sandbox account only (an account in
 * `removed` or not flagged sandbox reads nothing and takes no script), the exact key before the empty key, the newest entry first, a counted
 * script loses one call per take. Worlds and specs use it; `accounts` holds the connections it knows.
 */
export class MemoryProviderSandboxStore implements ProviderSandboxStore {
    readonly accounts = new Map<string, SandboxAccount>()
    readonly removed = new Set<string>()
    readonly entries: Array<MemoryEntry> = []

    /** Adds (or replaces) a connection the store knows. */
    open(account: SandboxAccount): SandboxAccount {
        this.accounts.set(account.id, account)
        return account
    }

    accountOf(workspaceId: string, connectionId: string): Promise<SandboxAccount | null> {
        const account = this.accounts.get(connectionId)
        return Promise.resolve(account?.workspaceId === workspaceId && !this.removed.has(connectionId) ? account : null)
    }

    keep(account: SandboxAccount, entry: SandboxEntryInput): Promise<void> {
        const seq = this.entries.length
        this.entries.push({
            ...entry,
            id: `sbx-${String(seq + 1)}`,
            workspaceId: account.workspaceId,
            connectionId: account.id,
            at: new Date(START + seq * 1000).toISOString(),
            remainingLeft: entry.remaining,
        })
        return Promise.resolve()
    }

    takeScript(account: SandboxAccount, operation: string, key: string): Promise<SandboxScriptOutcome | null> {
        const script = this.newest(account, "script", operation, key, (entry) => entry.remainingLeft === null || entry.remainingLeft > 0)
        if (script === undefined) return Promise.resolve(null)
        if (script.remainingLeft !== null) script.remainingLeft -= 1
        return Promise.resolve(script.body as SandboxScriptOutcome)
    }

    fixtureOf(account: SandboxAccount, operation: string, key: string): Promise<FoundFixture | null> {
        const fixture = this.newest(account, "fixture", operation, key, () => true)
        return Promise.resolve(fixture === undefined ? null : { value: (fixture.body as { value: unknown }).value })
    }

    calls(account: SandboxAccount, operation?: string): Promise<ReadonlyArray<SandboxCall>> {
        return Promise.resolve(
            this.live(account, "call")
                .filter((entry) => operation === undefined || entry.operation === operation)
                .map((entry) => {
                    const body = entry.body as Pick<SandboxCall, "request" | "result">
                    return { id: entry.id, operation: entry.operation, key: entry.key, request: body.request, result: body.result, at: entry.at }
                }),
        )
    }

    clearPlan(account: SandboxAccount): Promise<void> {
        for (let index = this.entries.length - 1; index >= 0; index -= 1) {
            const entry = this.entries[index]
            if (entry?.connectionId === account.id && (entry.kind === "fixture" || entry.kind === "script")) this.entries.splice(index, 1)
        }
        return Promise.resolve()
    }

    private live(account: SandboxAccount, kind: SandboxEntryInput["kind"]): ReadonlyArray<MemoryEntry> {
        const stored = this.accounts.get(account.id)
        if (stored?.sandbox !== true || this.removed.has(account.id)) return []
        return this.entries.filter((entry) => entry.connectionId === account.id && entry.workspaceId === account.workspaceId && entry.kind === kind)
    }

    private newest(
        account: SandboxAccount,
        kind: "fixture" | "script",
        operation: string,
        key: string,
        usable: (entry: MemoryEntry) => boolean,
    ): MemoryEntry | undefined {
        const candidates = this.live(account, kind).filter((entry) => entry.operation === operation && usable(entry))
        const pick = (wanted: string): MemoryEntry | undefined => candidates.filter((entry) => entry.key === wanted).at(-1)
        return pick(key) ?? (key === "" ? undefined : pick(""))
    }
}

/** A sandbox account (an iNET one by default), for a spec or a world. */
export const sandboxAccount = (overrides: Partial<SandboxAccount> = {}): SandboxAccount => ({
    id: "sbx-conn-1",
    workspaceId: "ws-1",
    provider: "inet",
    sandbox: true,
    ...overrides,
})

/** The real sandbox service over a memory store that already knows the account(s): what a provider's sandbox spec builds. */
export const sandboxServiceOf = (
    ...accounts: ReadonlyArray<SandboxAccount>
): { readonly store: MemoryProviderSandboxStore; readonly sandbox: ProviderSandboxService } => {
    const store = new MemoryProviderSandboxStore()
    for (const account of accounts) store.open(account)
    return { store, sandbox: new ProviderSandboxService(store) }
}
