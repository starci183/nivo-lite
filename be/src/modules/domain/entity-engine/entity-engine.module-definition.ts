import { defineCapabilityModule } from "@starci/nest-kit"
import type { EntityEngineRegistration } from "./entity-engine.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<EntityEngineRegistration>()
