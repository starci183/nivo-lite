import type { Type } from "@nestjs/common"
import type { AgentConnectionsDirectory, InstallationDirectory, KnowledgeLens, ModuleProfiles } from "./agents.port"

/** The ports the setup mode binds: the installations and the module definitions, without the knowledge lens. */
export interface AgentsSetupPorts {
    /** Implements the module installations port. */
    readonly installations: Type<InstallationDirectory>
    /** Implements the module definitions port. */
    readonly modules: Type<ModuleProfiles>
    /** Implements the agent connections port; an existing provider of the app. */
    readonly connections: Type<AgentConnectionsDirectory>
}

/** The classes that implement the ports of the other lanes; the app root passes them and the module binds each token to them. */
export interface AgentsPorts extends AgentsSetupPorts {
    /** Implements the business knowledge port. */
    readonly knowledge: Type<KnowledgeLens>
}

/** The options of the full agents capability (the api): every port, the dashboard and the engine status. */
export interface AgentsFullOptions {
    /** The classes of the other lanes behind the ports. */
    readonly ports: AgentsPorts
    /** A sync check younger than this means the sync is alive, ms. */
    readonly syncFreshMs: number
    /** Absent or false: the full capability. */
    readonly setupOnly?: false
}

/**
 * The options of the setup mode (the cli seed): only what applying a setup needs (the agent texts, the bundle builder the sync
 * queues for and the queue). It binds no knowledge lens and registers no engine status, so a call that reads knowledge is refused.
 */
export interface AgentsSetupOptions {
    /** The classes behind the installations and module definitions ports. */
    readonly ports: AgentsSetupPorts
    /** A sync check younger than this means the sync is alive, ms. */
    readonly syncFreshMs: number
    /** Registers the setup mode. */
    readonly setupOnly: true
}

/** The options of the agents capability: the full capability or its setup mode. */
export type AgentsOptions = AgentsFullOptions | AgentsSetupOptions

/** The default freshness of a sync check: 15 minutes (the scheduled sync touches it every five). */
export const AGENTS_SYNC_FRESH_MS = 15 * 60_000
