import { defineCapabilityModule } from "@starci/nest-kit"
import type { PlatformPortsOptions } from "./platform-ports.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<PlatformPortsOptions>()
