import { defineConfigurableModule } from "@starci/nest-kit"
import type { PollDueConnectionsOptions } from "./poll-due-connections.options"

/** The configurable-module base of the poll-due-connections module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<PollDueConnectionsOptions>()
