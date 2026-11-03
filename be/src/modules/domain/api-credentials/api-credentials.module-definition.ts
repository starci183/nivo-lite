import { defineCapabilityModule } from "@starci/nest-kit"
import type { ApiCredentialsOptions } from "./api-credentials.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ApiCredentialsOptions>()
