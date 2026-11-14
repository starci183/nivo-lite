import { defineCapabilityModule } from "@starci/nest-kit"
import type { CassoProviderOptions } from "./casso-provider.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<CassoProviderOptions>()
