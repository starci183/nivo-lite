import { defineCapabilityModule } from "@starci/nest-kit"
import type { ContentSettingsOptions } from "./content-settings.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ContentSettingsOptions>()
