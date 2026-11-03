import { defineCapabilityModule } from "@starci/nest-kit"
import type { ConnectorInterestOptions } from "./connector-interest.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ConnectorInterestOptions>()
