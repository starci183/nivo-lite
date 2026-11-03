import { defineConfigurableModule } from "@starci/nest-kit"
import type { ConnectChannelOptions } from "./connect-channel.options"

/** The configurable-module base of the connect-channel module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<ConnectChannelOptions>()
