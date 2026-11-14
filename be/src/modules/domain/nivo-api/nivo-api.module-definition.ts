import { defineCapabilityModule } from "@starci/nest-kit"
import type { NivoApiOptions } from "./nivo-api.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<NivoApiOptions>()
