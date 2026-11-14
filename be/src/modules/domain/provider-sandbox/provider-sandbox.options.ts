import type { ProviderSandboxSwitch } from "./provider-sandbox.contracts"

/** The provider-sandbox capability's options: the dev switch, as `parseProviderSandboxConfig` read it (the one read). */
export interface ProviderSandboxOptions {
    readonly sandbox: ProviderSandboxSwitch
    /**
     * The port this api listens on (`ServerOptions.port`): an inbound case is POSTed to the provider's own webhook route on
     * `http://127.0.0.1:<port>`, the same listener the provider would reach (R58/R62). Absent in an app that sends no case.
     */
    readonly loopbackPort?: number | undefined
}
