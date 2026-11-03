import { defineCapabilityModule } from "@starci/nest-kit"
import type { OpenclawOptions } from "./openclaw.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<OpenclawOptions>()
