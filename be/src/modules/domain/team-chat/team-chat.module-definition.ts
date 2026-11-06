import { defineCapabilityModule } from "@starci/nest-kit"
import type { TeamChatOptions } from "./team-chat.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<TeamChatOptions>()
