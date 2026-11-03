import { defineCapabilityModule } from "@starci/nest-kit"
import type { ApiKeysOptions } from "./api-keys.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ApiKeysOptions>()
