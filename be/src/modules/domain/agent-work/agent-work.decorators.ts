import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AgentWorkOptions } from "./agent-work.options"
import type {
    AgentBurstPolicy,
    AgentTagRights,
    AgentTagVisibilityPort,
    AgentTurnExecutor,
} from "./agent-work.port"

/** Token of the turn executor port: absent until a capability binds one, and then every wake is held for want of it. */
export const AGENT_TURN_EXECUTOR: unique symbol = Symbol("domain.agent-work.turn-executor")

/** Injects the turn executor port. Parameter type: AgentTurnExecutor. */
export const InjectAgentTurnExecutor = (): TypedParameterDecorator<AgentTurnExecutor> =>
    injector<AgentTurnExecutor>(AGENT_TURN_EXECUTOR)

/** Token of the tag rights port: absent until a capability binds one, and then no agent may tag another. */
export const AGENT_TAG_RIGHTS: unique symbol = Symbol("domain.agent-work.tag-rights")

/** Injects the tag rights port. Parameter type: AgentTagRights. */
export const InjectAgentTagRights = (): TypedParameterDecorator<AgentTagRights> =>
    injector<AgentTagRights>(AGENT_TAG_RIGHTS)

/** Token of the options of the agent-work capability. */
export const AGENT_WORK_OPTIONS: unique symbol = Symbol("domain.agent-work.options")

/** Injects the options of the agent-work capability. Parameter type: AgentWorkOptions. */
export const InjectAgentWorkOptions = (): TypedParameterDecorator<AgentWorkOptions> =>
    injector<AgentWorkOptions>(AGENT_WORK_OPTIONS)

/** Token of the tag visibility port: absent until the conversations side binds one, and then a tag shows nothing and moves nothing. */
export const AGENT_TAG_VISIBILITY: unique symbol = Symbol("domain.agent-work.tag-visibility")

/** Injects the tag visibility port. Parameter type: AgentTagVisibilityPort. */
export const InjectAgentTagVisibility = (): TypedParameterDecorator<AgentTagVisibilityPort> =>
    injector<AgentTagVisibilityPort>(AGENT_TAG_VISIBILITY)

/** Token of the burst policy port: absent until the graphs bind one, and then every wake takes the app's default burst. */
export const AGENT_BURST_POLICY: unique symbol = Symbol("domain.agent-work.burst-policy")

/** Injects the burst policy port. Parameter type: AgentBurstPolicy. */
export const InjectAgentBurstPolicy = (): TypedParameterDecorator<AgentBurstPolicy> =>
    injector<AgentBurstPolicy>(AGENT_BURST_POLICY)
