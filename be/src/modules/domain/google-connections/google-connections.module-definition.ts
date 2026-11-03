import { defineCapabilityModule } from "@starci/nest-kit"
import type { GoogleConnectionsOptions } from "./google-connections.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<GoogleConnectionsOptions>()
