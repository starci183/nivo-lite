import { defineConfigurableModule } from "@starci/nest-kit"
import type { TeamChatApiOptions } from "./team-chat.options"

/** The configurable base of the team chat feature. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<TeamChatApiOptions>()
