import { defineCapabilityModule } from "@starci/nest-kit"
import type { ContentCadenceOptions } from "./content-cadence.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ContentCadenceOptions>()
