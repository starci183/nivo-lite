import { defineCapabilityModule } from "@starci/nest-kit"
import type { BrainCommandsOptions } from "./brain-commands.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<BrainCommandsOptions>()
