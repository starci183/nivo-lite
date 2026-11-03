import { defineCapabilityModule } from "@starci/nest-kit"
import type { MessagesOptions } from "./messages.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<MessagesOptions>()
