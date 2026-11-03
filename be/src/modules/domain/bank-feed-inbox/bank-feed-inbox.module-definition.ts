import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { BankFeedInboxOptions } from "./bank-feed-inbox.options"

/** The configurable-module base of the bank-feed-inbox capability; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<BankFeedInboxOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    BankFeedInboxOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: BankFeedInboxOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
