import { defineCapabilityModule } from "@starci/nest-kit"
import type { TelegramInboxOptions } from "./telegram-inbox.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<TelegramInboxOptions>()
