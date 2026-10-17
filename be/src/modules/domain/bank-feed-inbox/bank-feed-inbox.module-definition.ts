import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { BankFeedInboxOptions } from "./bank-feed-inbox.options"

/** The configurable-module base of the bank-feed-inbox capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<BankFeedInboxOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
