import { defineCapabilityModule } from "@starci/nest-kit"
import type { ProviderSandboxOptions } from "./provider-sandbox.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ProviderSandboxOptions>()
