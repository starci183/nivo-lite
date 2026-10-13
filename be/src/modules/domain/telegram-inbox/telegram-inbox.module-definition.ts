import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { TelegramInboxOptions } from "./telegram-inbox.options"

/** The configurable-module base of the telegram-inbox capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<TelegramInboxOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
