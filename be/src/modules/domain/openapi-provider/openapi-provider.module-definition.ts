import { defineCapabilityModule } from "@starci/nest-kit"
import type { OpenApiProviderOptions } from "./openapi-provider.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<OpenApiProviderOptions>()
