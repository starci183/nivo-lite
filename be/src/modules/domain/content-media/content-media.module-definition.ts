import { defineCapabilityModule } from "@starci/nest-kit"
import type { ContentMediaOptions } from "./content-media.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ContentMediaOptions>()
