import { defineConfigurableModule } from "@starci/nest-kit"
import type { BankFeedPollMessageOptions } from "./bank-feed-poll-message.options"

/** The configurable-module base of the bank-feed-poll-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<BankFeedPollMessageOptions>()
