import { defineCapabilityModule } from "@starci/nest-kit"
import type { ThreadMessagesOptions } from "./thread-messages.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ThreadMessagesOptions>()
