import { defineCapabilityModule } from "@starci/nest-kit"
import type { HttpOptions } from "./http.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<HttpOptions>()
