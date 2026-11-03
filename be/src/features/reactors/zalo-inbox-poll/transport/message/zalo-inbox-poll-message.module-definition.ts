import { defineConfigurableModule } from "@starci/nest-kit"
import type { ZaloInboxPollMessageOptions } from "./zalo-inbox-poll-message.options"

/** The configurable-module base of the zalo-inbox-poll-message module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ZaloInboxPollMessageOptions>()
