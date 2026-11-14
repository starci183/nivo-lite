import { defineConfigurableModule } from "@starci/nest-kit"
import type { DeliverTeamChatTagQueueOptions } from "./deliver-team-chat-tag-queue.options"

/** The configurable-module base of the team-chat-tag-queue module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<DeliverTeamChatTagQueueOptions>()
