import { defineConfigurableModule } from "@starci/nest-kit"
import type { ZaloInboxPollReactorOptions } from "./zalo-inbox-poll.options"

/** The configurable-module base of the zalo-inbox-poll module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ZaloInboxPollReactorOptions>()
