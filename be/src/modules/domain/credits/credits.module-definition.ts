import { defineCapabilityModule } from "@starci/nest-kit"
import type { CreditsOptions } from "./credits.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<CreditsOptions>()
