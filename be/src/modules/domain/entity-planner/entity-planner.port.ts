import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { EntityPlannerOptions } from "./entity-planner.options"

/** Token of the options of the entity planner capability. */
export const ENTITY_PLANNER_OPTIONS: unique symbol = Symbol("domain.entity-planner.options")

/** Injects the options of the entity planner. Parameter type: EntityPlannerOptions. */
export const InjectEntityPlannerOptions = (): TypedParameterDecorator<EntityPlannerOptions> =>
    injector<EntityPlannerOptions>(ENTITY_PLANNER_OPTIONS)
