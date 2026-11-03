import { defineCapabilityModule } from "@starci/nest-kit"
import type { IdsOptions } from "./ids.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<IdsOptions>()
