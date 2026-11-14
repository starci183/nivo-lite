import { defineConfigurableModule } from "@starci/nest-kit"
import type { DeliverTeamChatTagOptions } from "./deliver-team-chat-tag.options"

/** The configurable-module base of the team-chat-tag job module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<DeliverTeamChatTagOptions>()
