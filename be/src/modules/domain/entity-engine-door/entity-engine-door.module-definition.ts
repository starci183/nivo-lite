import { defineCapabilityModule } from "@starci/nest-kit"
import type { EntityEngineDoorOptions } from "./entity-engine-door.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<EntityEngineDoorOptions>()
