import { defineCapabilityModule } from "@starci/nest-kit"
import type { ChatRecordsOptions } from "./chat-records.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ChatRecordsOptions>()
