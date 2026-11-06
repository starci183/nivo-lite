import { defineConfigurableModule } from "@starci/nest-kit"
import type { TeamChatGraphqlOptions } from "./team-chat-graphql.options"

/** The configurable base of the team chat GraphQL transport. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<TeamChatGraphqlOptions>()
