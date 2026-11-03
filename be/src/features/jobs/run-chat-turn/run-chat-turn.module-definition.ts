import { defineConfigurableModule } from "@starci/nest-kit"
import type { RunChatTurnOptions } from "./run-chat-turn.options"

/** The configurable-module base of the run-chat-turn module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RunChatTurnOptions>()
