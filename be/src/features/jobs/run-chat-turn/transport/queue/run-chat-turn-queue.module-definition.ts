import { defineConfigurableModule } from "@starci/nest-kit"
import type { RunChatTurnQueueOptions } from "./run-chat-turn-queue.options"

/** The configurable-module base of the run-chat-turn-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RunChatTurnQueueOptions>()
