import { defineConfigurableModule } from "@starci/nest-kit"
import type { TeamChatTurnsGraphqlOptions } from "./team-chat-turns-graphql.options"

/** The configurable-module base of the team-chat-turns GraphQL module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<TeamChatTurnsGraphqlOptions>()
