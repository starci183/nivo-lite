import { defineCapabilityModule } from "@starci/nest-kit"
import type { CreatomateProviderOptions } from "./creatomate-provider.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<CreatomateProviderOptions>()
