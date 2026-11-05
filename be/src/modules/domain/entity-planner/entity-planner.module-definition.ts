import { defineCapabilityModule } from "@starci/nest-kit"
import { ENTITY_PLANNER_OPTIONS } from "./entity-planner.port"
import type { EntityPlannerOptions } from "./entity-planner.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<EntityPlannerOptions>({
    optionsInjectionToken: ENTITY_PLANNER_OPTIONS,
})
