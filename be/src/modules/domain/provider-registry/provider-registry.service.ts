import { ProviderRegistryError, ProviderRegistryErrorCode } from "./errors/provider-registry.error"
import type { OptionalProviderPort } from "./provider-ports.contracts"

/** A provider's two implementations of one port: the live one (its real host) and, when it has one, its sandbox twin (lane concept provider-sandbox). */
export interface ProviderImplementations<Port extends { readonly provider: string }> {
    readonly live: Port
    readonly sandbox: Port
}

/** What a lookup needs of an account: its provider key and its creation-time sandbox flag. */
export interface PortAccount {
    readonly provider: string
    readonly sandbox: boolean
}

/**
 * Providers by their key for one capability, each with its live implementation and, optionally, its sandbox one. A provider module
 * registers once at boot; core code resolves the port of an ACCOUNT through `portFor`, THE ONE SWITCH between live and sandbox (lane
 * concept provider-sandbox rule 2): a live account answers the live port, a sandbox account the sandbox port or the typed refusal
 * `PROVIDER_SANDBOX_MISSING`, never the live one. A second registration under a key replaces the first.
 */
export abstract class ProviderRegistryService<Port extends { readonly provider: string }> {
    private readonly live = new Map<string, Port>()
    private readonly sandboxes = new Map<string, Port>()

    /** Registers a provider's live port, or its live and sandbox ports (both must name the same provider). */
    register(entry: Port | ProviderImplementations<Port>): void {
        if (!("live" in entry)) {
            this.live.set(entry.provider, entry)
            this.sandboxes.delete(entry.provider)
            return
        }
        if (entry.sandbox.provider !== entry.live.provider) {
            throw new ProviderRegistryError({
                code: ProviderRegistryErrorCode.SandboxMismatch,
                params: { provider: entry.live.provider, sandbox: entry.sandbox.provider },
            })
        }
        this.live.set(entry.live.provider, entry.live)
        this.sandboxes.set(entry.live.provider, entry.sandbox)
    }

    /**
     * The port that serves an account: a live account's provider's live port (undefined when none registered: the caller's own "not
     * served" answer); a sandbox account's provider's sandbox port, or `PROVIDER_SANDBOX_MISSING` when it registered none.
     */
    portFor(account: PortAccount): OptionalProviderPort<Port> {
        if (!account.sandbox) return this.live.get(account.provider)
        const sandbox = this.sandboxes.get(account.provider)
        if (sandbox === undefined) {
            throw new ProviderRegistryError({ code: ProviderRegistryErrorCode.SandboxMissing, params: { provider: account.provider } })
        }
        return sandbox
    }

    /**
     * The LIVE port of a provider, for the provider's own inbound door only (its webhook, proven against the provider's signature before
     * any account is read): it can never answer a sandbox port. Every account lookup uses `portFor`.
     */
    liveOf(provider: string): OptionalProviderPort<Port> {
        return this.live.get(provider)
    }

    /** True when the provider registered a port. */
    has(provider: string): boolean {
        return this.live.has(provider)
    }

    /** The keys of the registered providers, in registration order; a listing resolves each account through `portFor`. */
    providers(): ReadonlyArray<string> {
        return [...this.live.keys()]
    }
}
