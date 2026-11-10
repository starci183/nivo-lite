import { defineCapabilityModule } from "@starci/nest-kit"
import { TEAM_CHAT_TURNS_OPTIONS } from "./team-chat-turns.decorators"
import type { TeamChatTurnsOptions } from "./team-chat-turns.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<TeamChatTurnsOptions>({
    optionsInjectionToken: TEAM_CHAT_TURNS_OPTIONS,
})
