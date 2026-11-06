import { defineCapabilityModule } from "@starci/nest-kit"
import type { ChatRoomDirectoryOptions } from "./chat-room-directory.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ChatRoomDirectoryOptions>()
