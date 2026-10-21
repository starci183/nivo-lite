import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { SeedAuth, WorkspaceSeedOptions } from "./workspace-seed.options"
import type { SeedAgentRecords, SeedConnectors, SeedSources, SeedToolGrants } from "./workspace-seed.port"

/** Token of the workspace-seed options, exported so a spec can provide it. */
export const WORKSPACE_SEED_OPTIONS: unique symbol = Symbol("domain.workspace-seed.options")

/** Injects the options of the workspace-seed capability. Parameter type: WorkspaceSeedOptions. */
export const InjectWorkspaceSeedOptions = (): TypedParameterDecorator<WorkspaceSeedOptions> =>
    injector<WorkspaceSeedOptions>(WORKSPACE_SEED_OPTIONS)

/** Token of the Auth administration the composition root hands to the capability. */
export const SEED_AUTH: unique symbol = Symbol("domain.workspace-seed.auth")

/** Injects the Auth administration. Parameter type: SeedAuth. */
export const InjectSeedAuth = (): TypedParameterDecorator<SeedAuth> => injector<SeedAuth>(SEED_AUTH)

/** Token of the agents owner behind a profile run. */
export const SEED_AGENTS: unique symbol = Symbol("domain.workspace-seed.agents")

/** Injects the agents owner. Parameter type: SeedAgentRecords. */
export const InjectSeedAgents = (): TypedParameterDecorator<SeedAgentRecords> => injector<SeedAgentRecords>(SEED_AGENTS)

/** Token of the documents owner behind a profile run. */
export const SEED_SOURCES: unique symbol = Symbol("domain.workspace-seed.sources")

/** Injects the documents owner. Parameter type: SeedSources. */
export const InjectSeedSources = (): TypedParameterDecorator<SeedSources> => injector<SeedSources>(SEED_SOURCES)

/** Token of the tool grants owner behind a profile run. */
export const SEED_TOOL_GRANTS: unique symbol = Symbol("domain.workspace-seed.tool-grants")

/** Injects the tool grants owner. Parameter type: SeedToolGrants. */
export const InjectSeedToolGrants = (): TypedParameterDecorator<SeedToolGrants> =>
    injector<SeedToolGrants>(SEED_TOOL_GRANTS)

/** Token of the gateway console behind a profile run. */
export const SEED_CONNECTORS: unique symbol = Symbol("domain.workspace-seed.connectors")

/** Injects the gateway console. Parameter type: SeedConnectors. */
export const InjectSeedConnectors = (): TypedParameterDecorator<SeedConnectors> =>
    injector<SeedConnectors>(SEED_CONNECTORS)
