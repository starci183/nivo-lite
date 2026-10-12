import type { Type } from "@nestjs/common"
import type { InstallationDirectory, KnowledgeLens, ModuleProfiles, UsageGate } from "./agents.port"

/** The classes that implement the ports of the other lanes; the app root passes them and the module binds each token to them. */
export interface AgentsPorts {
    /** Implements the module installations port. */
    readonly installations: Type<InstallationDirectory>
    /** Implements the business knowledge port. */
    readonly knowledge: Type<KnowledgeLens>
    /** Implements the module definitions port. */
    readonly modules: Type<ModuleProfiles>
    /** Implements the usage port. */
    readonly usage: Type<UsageGate>
}

/** The tunables of the agents capability. */
export interface AgentsTuning {
    /** How often a caller looks at its generation row, ms. */
    readonly generationPollMs: number
    /** How long to wait after openclaw.json changed before a turn is sent to a new agent, ms. */
    readonly reloadSettleMs: number
    /** A sync check younger than this means the sync is alive, ms. */
    readonly syncFreshMs: number
}

/** The options of the agents capability. */
export interface AgentsOptions extends AgentsTuning {
    /** The classes of the other lanes behind the ports. */
    readonly ports: AgentsPorts
}

/** The defaults of the tunables: 400 ms polling, a 2 s reload settle (the gateway debounces 300 ms) and 15 minutes of sync freshness. */
export const AGENTS_TUNING: AgentsTuning = {
    generationPollMs: 400,
    reloadSettleMs: 2000,
    syncFreshMs: 15 * 60_000,
}
