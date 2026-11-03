import { defineCapabilityModule } from "@starci/nest-kit"
import type { DecisionsOptions } from "./decisions.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<DecisionsOptions>()
