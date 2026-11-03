import { defineCapabilityModule } from "@starci/nest-kit"
import type { ChatFilesOptions } from "./chat-files.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ChatFilesOptions>()
