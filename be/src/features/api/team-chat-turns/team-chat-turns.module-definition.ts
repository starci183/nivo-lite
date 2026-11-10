import { defineConfigurableModule } from "@starci/nest-kit"
import type { TeamChatTurnsApiOptions } from "./team-chat-turns.options"

/** The configurable-module base of the team-chat-turns feature module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<TeamChatTurnsApiOptions>()
