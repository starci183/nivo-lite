import { defineCapabilityModule } from "@starci/nest-kit"
import type { ProviderRegistryOptions } from "./provider-registry.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ProviderRegistryOptions>()
