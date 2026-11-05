import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { EntityEngineOptions } from "./entity-engine.options"

/** Token of the entity engine options, exported so a spec can provide it. */
export const ENTITY_ENGINE_OPTIONS: unique symbol = Symbol("domain.entity-engine.options")

/** Injects the options of the entity engine. Parameter type: EntityEngineOptions. */
export const InjectEntityEngineOptions = (): TypedParameterDecorator<EntityEngineOptions> =>
    injector<EntityEngineOptions>(ENTITY_ENGINE_OPTIONS)
