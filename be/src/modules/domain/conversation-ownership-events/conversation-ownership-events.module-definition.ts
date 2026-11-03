import { defineCapabilityModule } from "@starci/nest-kit"
import type { ConversationOwnershipEventsOptions } from "./conversation-ownership-events.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ConversationOwnershipEventsOptions>()
