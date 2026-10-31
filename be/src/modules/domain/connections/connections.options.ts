import type { Type } from "@nestjs/common"
import type { Secret } from "@modules/platform/config"
import type { ConnectionAgentsDirectory } from "./connections.port"

/** Connections configuration parsed once at API boot. */
export interface ConnectionsOptions {
    /** The AES-256-GCM key (32 bytes, base64) that seals every stored provider credential. */
    readonly channelTokenKey: Secret
    /** The required site URL used to build addresses when no public override is declared. */
    readonly siteUrl: string
    /** The public origin of the site (browsers are sent back to it), absent in a bare local setup. */
    readonly publicSiteUrl: string | undefined
    /** The public origin of the back end, where providers call webhooks and callbacks; the site origin when absent. */
    readonly publicApiUrl?: string | undefined
    /** The classes behind the ports of the other lanes; absent in an app that composes no agents. */
    readonly ports?: ConnectionsPorts | undefined
}

/** The classes that implement the ports of the other lanes. */
export interface ConnectionsPorts {
    /** Implements the agents port; an existing provider of the app. */
    readonly agents: Type<ConnectionAgentsDirectory>
}

/** What the environment alone decides; the app root adds the ports. */
export type ConnectionsConfig = Omit<ConnectionsOptions, "ports">

/**
 * The options of the read-only mode (the mcp app): the status reads of the agent bindings, with no sealing key, no site address and
 * nothing that writes or calls a provider.
 */
export interface ConnectionsReadOnlyOptions {
    /** Registers the read-only mode. */
    readonly readOnly: true
}

/** What the connections capability needs from the composition root: the full options, or the read-only mode. */
export type ConnectionsModuleOptions = ConnectionsOptions | ConnectionsReadOnlyOptions
