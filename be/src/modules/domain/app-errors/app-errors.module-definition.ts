import { defineCapabilityModule } from "@starci/nest-kit"
import type { AppErrorsOptions } from "./app-errors.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AppErrorsOptions>()
