import { defineCapabilityModule } from "@starci/nest-kit"
import type { NativeToolsOptions } from "./native-tools.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<NativeToolsOptions>()
