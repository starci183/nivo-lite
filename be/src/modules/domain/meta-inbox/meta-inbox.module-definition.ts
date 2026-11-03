import { defineCapabilityModule } from "@starci/nest-kit"
import type { MetaInboxOptions } from "./meta-inbox.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<MetaInboxOptions>()
