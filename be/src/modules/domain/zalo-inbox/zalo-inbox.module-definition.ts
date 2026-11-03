import { defineCapabilityModule } from "@starci/nest-kit"
import type { ZaloInboxOptions } from "./zalo-inbox.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ZaloInboxOptions>()
