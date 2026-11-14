import type { PortProvider } from "@nivo-lite/agent-sdk/port"
import type { SpecLocale } from "@nivo-lite/agent-sdk/schema"
import type { RunIn, ScopedTx } from "@modules/domain/entity-engine"
import type { Locale } from "@modules/platform/i18n"

/** What every request for a service says about the run it is for. */
export interface PluginServiceRun {
    /** The seat that asked; null (the default) for a customer, a schedule or the agent. */
    readonly memberId?: string | null
    /** The language of the words the service returns; "vi" by default. */
    readonly locale?: SpecLocale
    /**
     * What the service's records reach: `own` (the default) only the records stamped with the agent, `all` every record of the workspace
     * (every write is still stamped with the agent). Ignored when `transaction` is given: the caller's scope decides.
     */
    readonly sees?: "own" | "all"
    /**
     * The engine scope the caller already holds. The service's entity calls then run in THIS transaction (they commit or roll back with
     * the caller's work, no second transaction opens). It must be of the same workspace and act for the same agent as the request.
     * Absent: each entity call opens a scope of its own, as the agent; `within` runs all the calls of a callback in one.
     */
    readonly transaction?: ScopedTx
}

/** Which agent's service is asked for: the agent that owns it, in a workspace. */
export interface PluginServiceScope extends PluginServiceRun {
    /** The workspace. */
    readonly workspaceId: string
    /** The installed agent (`agents.id`) the service works for: the service of its module is built, and its records are the ones reached. */
    readonly agentId: string
}

/** Which module's service is asked for, for a caller that holds a module and not an agent. */
export interface PluginModuleServiceScope extends PluginServiceRun {
    /** The workspace. */
    readonly workspaceId: string
    /** The module key (the agent key of the template agent). */
    readonly moduleKey: string
    /** The installation of a module that may be installed twice; absent: the oldest installation of the module. */
    readonly installationId?: string
}

/** What the ports of one service run are bound to: the shape the port host reads (the workbench door's `DoorRun` fits it). */
export interface PluginServicePortRun {
    /** The workspace the run is for. */
    readonly workspaceId: string
    /** Where each port call runs: the one transaction of the run, or a transaction of its own per call. */
    readonly runIn: RunIn
    /** The id of the service, which names the run. */
    readonly name: string
    /** Always null: a service lists no rows of a read. */
    readonly dataKind: string | null
    /** The seat that asks; null when none. */
    readonly memberId: string | null
    /** The language of the viewer. */
    readonly locale: Locale
    /** The fields a read declares; empty for a service. */
    readonly fields: ReadonlyArray<string>
}

/** The port host of the plugin services: whatever provides the ports of a run (the workbench door's `DoorPortsService`, bound at the composition root). */
export interface PluginServicePorts {
    /** The provider of the ports of one run. */
    readonly providerFor: (run: PluginServicePortRun) => PortProvider
}
