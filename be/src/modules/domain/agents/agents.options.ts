import type { Type } from "@nestjs/common"
import type { InstallationDirectory, KnowledgeLens, ModuleProfiles } from "./agents.port"

/** The classes that implement the ports of the other lanes; the app root passes them and the module binds each token to them. */
export interface AgentsPorts {
    /** Implements the module installations port. */
    readonly installations: Type<InstallationDirectory>
    /** Implements the business knowledge port. */
    readonly knowledge: Type<KnowledgeLens>
    /** Implements the module definitions port. */
    readonly modules: Type<ModuleProfiles>
}

/** The options of the agents capability. */
export interface AgentsOptions {
    /** The classes of the other lanes behind the ports. */
    readonly ports: AgentsPorts
    /** A sync check younger than this means the sync is alive, ms. */
    readonly syncFreshMs: number
}

/** The default freshness of a sync check: 15 minutes (the scheduled sync touches it every five). */
export const AGENTS_SYNC_FRESH_MS = 15 * 60_000
