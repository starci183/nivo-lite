import type {
    KeptState,
    ProviderSandboxStore,
    SandboxAccount,
    SandboxCall,
    SandboxCallInput,
    SandboxWebhookPost,
    SandboxWebhookPoster,
    SandboxWebhookReply,
} from "@modules/domain/provider-sandbox"
import { ProviderSandboxService } from "@modules/domain/provider-sandbox"

/** One kept entry of the memory store, in insertion order. */
interface MemoryEntry {
    readonly id: string
    readonly connectionId: string
    readonly workspaceId: string
    readonly kind: "state" | "call"
    readonly name: string
    readonly key: string
    readonly body: unknown
    readonly at: string
}

/** A fixed clock start for the log's times (deterministic). */
const START = Date.UTC(2026, 10, 14, 12, 0, 0)

/**
 * The provider sandbox store in memory, with the SAME rules as the database one: entries of a live sandbox account only (an account in
 * `removed` or not flagged sandbox reads nothing), the newest state wins. Worlds and specs use it; `accounts` holds the connections it knows.
 */
export class MemoryProviderSandboxStore implements ProviderSandboxStore {
    readonly accounts = new Map<string, SandboxAccount>()
    readonly removed = new Set<string>()
    readonly entries: Array<MemoryEntry> = []
    private kept = 0

    /** Adds (or replaces) a connection the store knows. */
    open(account: SandboxAccount): SandboxAccount {
        this.accounts.set(account.id, account)
        return account
    }

    accountOf(workspaceId: string, connectionId: string): Promise<SandboxAccount | null> {
        const account = this.known(connectionId)
        return Promise.resolve(account?.workspaceId === workspaceId ? account : null)
    }

    accountOfId(connectionId: string): Promise<SandboxAccount | null> {
        return Promise.resolve(this.known(connectionId))
    }

    stateOf(account: SandboxAccount, name: string, key: string): Promise<KeptState | null> {
        const kept = this.live(account, "state").filter((entry) => entry.name === name && entry.key === key).at(-1)
        return Promise.resolve(kept === undefined ? null : { value: kept.body })
    }

    keepState(account: SandboxAccount, name: string, key: string, value: unknown): Promise<void> {
        this.keep(account, "state", name, key, value ?? null)
        return Promise.resolve()
    }

    logCall(account: SandboxAccount, call: SandboxCallInput): Promise<void> {
        this.keep(account, "call", call.operation, call.key, { request: call.request ?? null, result: call.result })
        return Promise.resolve()
    }

    countCalls(account: SandboxAccount, operation: string): Promise<number> {
        return Promise.resolve(this.live(account, "call").filter((entry) => entry.name === operation).length)
    }

    calls(account: SandboxAccount, operation?: string): Promise<ReadonlyArray<SandboxCall>> {
        return Promise.resolve(
            this.live(account, "call")
                .filter((entry) => operation === undefined || entry.name === operation)
                .map((entry) => {
                    const body = entry.body as Pick<SandboxCall, "request" | "result">
                    return { id: entry.id, operation: entry.name, key: entry.key, request: body.request, result: body.result, at: entry.at }
                }),
        )
    }

    reset(account: SandboxAccount): Promise<void> {
        for (let index = this.entries.length - 1; index >= 0; index -= 1) {
            if (this.entries[index]?.connectionId === account.id) this.entries.splice(index, 1)
        }
        return Promise.resolve()
    }

    private known(connectionId: string): SandboxAccount | null {
        return this.removed.has(connectionId) ? null : (this.accounts.get(connectionId) ?? null)
    }

    private keep(account: SandboxAccount, kind: "state" | "call", name: string, key: string, body: unknown): void {
        const seq = this.kept
        this.kept += 1
        this.entries.push({
            id: `sbx-${String(seq + 1)}`,
            connectionId: account.id,
            workspaceId: account.workspaceId,
            kind,
            name,
            key,
            body,
            at: new Date(START + seq * 1000).toISOString(),
        })
    }

    private live(account: SandboxAccount, kind: "state" | "call"): ReadonlyArray<MemoryEntry> {
        if (this.known(account.id)?.sandbox !== true) return []
        return this.entries.filter((entry) => entry.connectionId === account.id && entry.workspaceId === account.workspaceId && entry.kind === kind)
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

/** The real sandbox frame (switched ON) over a memory store that knows the account(s): what a provider's sandbox spec builds. */
export const sandboxServiceOf = (
    ...accounts: ReadonlyArray<SandboxAccount>
): { readonly store: MemoryProviderSandboxStore; readonly sandbox: ProviderSandboxService } => {
    const store = new MemoryProviderSandboxStore()
    for (const account of accounts) store.open(account)
    return { store, sandbox: new ProviderSandboxService(store, { enabled: true }) }
}

/** The same frame with the dev switch OFF (production): every call is refused `PROVIDER_SANDBOX_OFF`. */
export const sandboxServiceOff = (
    ...accounts: ReadonlyArray<SandboxAccount>
): { readonly store: MemoryProviderSandboxStore; readonly sandbox: ProviderSandboxService } => {
    const store = new MemoryProviderSandboxStore()
    for (const account of accounts) store.open(account)
    return { store, sandbox: new ProviderSandboxService(store, { enabled: false }) }
}

/**
 * A webhook poster that records each call and answers it (by default `200 { success: true }`; `answer` may hand the call to a real
 * controller in-process, as the SePay case specs do). Worlds and specs use it instead of the loopback HTTP poster.
 */
export class RecordingWebhookPoster implements SandboxWebhookPoster {
    readonly posts: Array<SandboxWebhookPost> = []

    constructor(
        private readonly answer: (call: SandboxWebhookPost) => Promise<SandboxWebhookReply> = () =>
            Promise.resolve({ status: 200, body: { success: true } }),
    ) {}

    async post(call: SandboxWebhookPost): Promise<SandboxWebhookReply> {
        this.posts.push(call)
        return await this.answer(call)
    }
}
