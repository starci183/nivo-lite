import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { SeedAuth, WorkspaceSeedOptions } from "./workspace-seed.options"
import type { SeedAgentRecords } from "./workspace-seed.port"

/** Token of the workspace-seed options, exported so a spec can provide it. */
export const WORKSPACE_SEED_OPTIONS: unique symbol = Symbol("domain.workspace-seed.options")

/** Injects the options of the workspace-seed capability. Parameter type: WorkspaceSeedOptions. */
export const InjectWorkspaceSeedOptions = (): TypedParameterDecorator<WorkspaceSeedOptions> =>
    injector<WorkspaceSeedOptions>(WORKSPACE_SEED_OPTIONS)

/** Token of the Auth administration the composition root hands to the capability. */
export const SEED_AUTH: unique symbol = Symbol("domain.workspace-seed.auth")

/** Injects the Auth administration. Parameter type: SeedAuth. */
export const InjectSeedAuth = (): TypedParameterDecorator<SeedAuth> => injector<SeedAuth>(SEED_AUTH)

/** Token of the agents owner behind a seed run. */
export const SEED_AGENTS: unique symbol = Symbol("domain.workspace-seed.agents")

/** Injects the agents owner. Parameter type: SeedAgentRecords. */
export const InjectSeedAgents = (): TypedParameterDecorator<SeedAgentRecords> => injector<SeedAgentRecords>(SEED_AGENTS)
