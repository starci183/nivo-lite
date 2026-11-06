import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { EngineFailureAlerts } from "./entity-engine.contracts"
import type { EntityEngineOptions } from "./entity-engine.options"

/** Token of the entity engine options, exported so a spec can provide it. */
export const ENTITY_ENGINE_OPTIONS: unique symbol = Symbol("domain.entity-engine.options")

/** Injects the options of the entity engine. Parameter type: EntityEngineOptions. */
export const InjectEntityEngineOptions = (): TypedParameterDecorator<EntityEngineOptions> =>
    injector<EntityEngineOptions>(ENTITY_ENGINE_OPTIONS)

/** Token of the alerts of a parked job, exported so a spec can provide it. */
export const ENGINE_FAILURE_ALERTS: unique symbol = Symbol("domain.entity-engine.failure-alerts")

/** Injects the alerts of a parked job. Parameter type: EngineFailureAlerts. */
export const InjectEngineFailureAlerts = (): TypedParameterDecorator<EngineFailureAlerts> =>
    injector<EngineFailureAlerts>(ENGINE_FAILURE_ALERTS)
