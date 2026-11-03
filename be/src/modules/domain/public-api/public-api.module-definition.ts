import { defineCapabilityModule } from "@starci/nest-kit"
import type { PublicApiOptions } from "./public-api.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<PublicApiOptions>()
