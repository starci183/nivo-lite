import { defineCapabilityModule } from "@starci/nest-kit"
import type { ChatActivityOptions } from "./chat-activity.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ChatActivityOptions>()
