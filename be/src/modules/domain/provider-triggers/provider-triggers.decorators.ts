import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type {
    ProviderTriggerAgentNames,
    ProviderTriggerCoreDeciders,
    ProviderTriggerDeciderReader,
    ProviderTriggerReceivers,
} from "./provider-triggers.contracts"

/** Token of the agent names port, bound by the app to the capability that owns the agents; with none bound names read null. */
export const PROVIDER_TRIGGER_AGENT_NAMES: unique symbol = Symbol("domain.provider-triggers.agent-names")

/** Injects the agent names port. Parameter type: ProviderTriggerAgentNames. */
export const InjectProviderTriggerAgentNames = (): TypedParameterDecorator<ProviderTriggerAgentNames> =>
    injector<ProviderTriggerAgentNames>(PROVIDER_TRIGGER_AGENT_NAMES)

/** Token of the receivers port, bound by the capability that owns the workflows; with none bound a trigger wakes nobody. */
export const PROVIDER_TRIGGER_RECEIVERS: unique symbol = Symbol("domain.provider-triggers.receivers")

/** Injects the receivers port. Parameter type: ProviderTriggerReceivers. */
export const InjectProviderTriggerReceivers = (): TypedParameterDecorator<ProviderTriggerReceivers> =>
    injector<ProviderTriggerReceivers>(PROVIDER_TRIGGER_RECEIVERS)

/** Token of the core deciders port, bound by the provider whose own path hands a trigger's events to an agent. */
export const PROVIDER_TRIGGER_CORE_DECIDERS: unique symbol = Symbol("domain.provider-triggers.core-deciders")

/** Injects the core deciders port. Parameter type: ProviderTriggerCoreDeciders. */
export const InjectProviderTriggerCoreDeciders = (): TypedParameterDecorator<ProviderTriggerCoreDeciders> =>
    injector<ProviderTriggerCoreDeciders>(PROVIDER_TRIGGER_CORE_DECIDERS)

/** Token of the bound decider reader, bound by this capability to its store; a provider's core path reads the owner's binding through it. */
export const PROVIDER_TRIGGER_DECIDER_READER: unique symbol = Symbol("domain.provider-triggers.decider-reader")

/** Injects the bound decider reader. Parameter type: ProviderTriggerDeciderReader. */
export const InjectProviderTriggerDeciderReader = (): TypedParameterDecorator<ProviderTriggerDeciderReader> =>
    injector<ProviderTriggerDeciderReader>(PROVIDER_TRIGGER_DECIDER_READER)
