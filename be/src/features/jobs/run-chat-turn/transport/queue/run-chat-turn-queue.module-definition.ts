import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { ConfigurableModuleHost } from "@nestjs/common"
import type { RunChatTurnQueueOptions } from "./run-chat-turn-queue.options"

type Host = ConfigurableModuleHost<RunChatTurnQueueOptions, "register", "create">

const definition: Host = new ConfigurableModuleBuilder<RunChatTurnQueueOptions>().setClassMethodName("register").build()

/** The configurable-module base of the run-chat-turn-queue module. */
export const ConfigurableModuleClass: Host["ConfigurableModuleClass"] = definition.ConfigurableModuleClass

/** The configurable-module base of the run-chat-turn-queue module. */
export const MODULE_OPTIONS_TOKEN: Host["MODULE_OPTIONS_TOKEN"] = definition.MODULE_OPTIONS_TOKEN

/** The configurable-module base of the run-chat-turn-queue module. */
export const OPTIONS_TYPE: Host["OPTIONS_TYPE"] = definition.OPTIONS_TYPE
