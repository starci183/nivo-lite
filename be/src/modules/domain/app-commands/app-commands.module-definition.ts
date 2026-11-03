import { defineCapabilityModule } from "@starci/nest-kit"
import type { AppCommandsOptions } from "./app-commands.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AppCommandsOptions>()
