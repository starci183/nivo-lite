import { defineCapabilityModule } from "@starci/nest-kit"
import type { ChatNodePortsOptions } from "./chat-node-ports.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ChatNodePortsOptions>()
