import { defineCapabilityModule } from "@starci/nest-kit"
import type { BankFeedInboxOptions } from "./bank-feed-inbox.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<BankFeedInboxOptions>()
