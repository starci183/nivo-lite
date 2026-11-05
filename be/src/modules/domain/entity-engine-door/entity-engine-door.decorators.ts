import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { EntityEngineDoorOptions } from "./entity-engine-door.options"

/** Token of the door provider options, exported so a spec can provide it. */
export const ENTITY_ENGINE_DOOR_OPTIONS: unique symbol = Symbol("domain.entity-engine-door.options")

/** Injects the options of the door provider. Parameter type: EntityEngineDoorOptions. */
export const InjectEntityEngineDoorOptions = (): TypedParameterDecorator<EntityEngineDoorOptions> =>
    injector<EntityEngineDoorOptions>(ENTITY_ENGINE_DOOR_OPTIONS)

/** Token of the declared jobs this capability brings, for the app root that hands every module job to the entity engine. */
export const ENTITY_ENGINE_DOOR_JOBS: unique symbol = Symbol("domain.entity-engine-door.jobs")
