import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { OpenclawAgentSyncOptions } from "./openclaw-agent-sync.options"

/** Token of the openclaw-agent-sync options, exported so a spec can provide it. */
export const OPENCLAW_AGENT_SYNC_OPTIONS: unique symbol = Symbol("domain.openclaw-agent-sync.options")

/** Injects the openclaw-agent-sync options. Parameter type: OpenclawAgentSyncOptions. */
export const InjectSyncOptions = (): TypedParameterDecorator<OpenclawAgentSyncOptions> =>
    injector<OpenclawAgentSyncOptions>(OPENCLAW_AGENT_SYNC_OPTIONS)
