import { defineCapabilityModule } from "@starci/nest-kit"
import type { ConnectionCommandsOptions } from "./connection-commands.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ConnectionCommandsOptions>()
