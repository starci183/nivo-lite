import { defineCapabilityModule } from "@starci/nest-kit"
import type { ChatMarkersOptions } from "./chat-markers.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ChatMarkersOptions>()
