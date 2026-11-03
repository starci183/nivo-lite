import { defineConfigurableModule } from "@starci/nest-kit"
import type { BankFeedPollReactorOptions } from "./bank-feed-poll.options"

/** The configurable-module base of the bank-feed-poll module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<BankFeedPollReactorOptions>()
