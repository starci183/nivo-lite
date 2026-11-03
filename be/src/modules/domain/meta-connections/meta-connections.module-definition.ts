import { defineCapabilityModule } from "@starci/nest-kit"
import type { MetaConnectionsOptions } from "./meta-connections.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<MetaConnectionsOptions>()
