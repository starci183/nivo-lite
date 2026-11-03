import { defineCapabilityModule } from "@starci/nest-kit"
import type { MetaCommentsOptions } from "./meta-comments.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<MetaCommentsOptions>()
