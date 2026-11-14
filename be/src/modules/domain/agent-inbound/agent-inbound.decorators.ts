import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { InboundStopReporter } from "./agent-inbound-door.contracts"
import type { InboundAdapterRegistry } from "./agent-inbound.port"

/** Token of the stop reporter: the capability that can tell a person (the team chat) binds it. */
export const INBOUND_STOP_REPORTER: unique symbol = Symbol("domain.agent-inbound.stop-reporter")

/** Injects the stop reporter. Parameter type: InboundStopReporter. */
export const InjectInboundStopReporter = (): TypedParameterDecorator<InboundStopReporter> =>
    injector<InboundStopReporter>(INBOUND_STOP_REPORTER)

/** Token of the adapter registry: any capability or plug-in adds its adapters through it. */
export const INBOUND_ADAPTER_REGISTRY: unique symbol = Symbol("domain.agent-inbound.adapter-registry")

/** Injects the adapter registry. Parameter type: InboundAdapterRegistry. */
export const InjectInboundAdapterRegistry = (): TypedParameterDecorator<InboundAdapterRegistry> =>
    injector<InboundAdapterRegistry>(INBOUND_ADAPTER_REGISTRY)
