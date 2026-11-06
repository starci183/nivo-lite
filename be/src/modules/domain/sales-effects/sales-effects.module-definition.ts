import { defineCapabilityModule } from "@starci/nest-kit"
import type { SalesEffectsOptions } from "./sales-effects.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<SalesEffectsOptions>()
