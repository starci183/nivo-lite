/**
 * Providers by their key for one capability. A provider module registers its implementation once at boot; core code looks it up by the
 * provider key of a connection and never names a provider. A second registration under a key replaces the first.
 */
export abstract class ProviderRegistry<Port extends { readonly provider: string }> {
    private readonly ports = new Map<string, Port>()

    /** Registers the port under its provider key. */
    register(port: Port): void {
        this.ports.set(port.provider, port)
    }

    /** The port of a provider, or undefined when none registered. */
    of(provider: string): Port | undefined {
        return this.ports.get(provider)
    }

    /** True when the provider registered. */
    has(provider: string): boolean {
        return this.ports.has(provider)
    }

    /** Every registered port, in registration order. */
    all(): ReadonlyArray<Port> {
        return [...this.ports.values()]
    }
}
