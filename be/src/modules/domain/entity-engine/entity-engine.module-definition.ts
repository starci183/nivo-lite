import { defineCapabilityModule } from "@starci/nest-kit"
import type { EntityEngineOptions } from "./entity-engine.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<EntityEngineOptions>()
