import { defineCapabilityModule } from "@starci/nest-kit"
import type { ContentPillarsOptions } from "./content-pillars.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ContentPillarsOptions>()
