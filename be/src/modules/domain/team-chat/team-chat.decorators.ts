import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { TeamChatTags } from "./team-chat.port"

/** Token of the tag port; the agents capability binds it. */
export const TEAM_CHAT_TAGS: unique symbol = Symbol("domain.team-chat.tags")

/** Injects the tag port. Parameter type: TeamChatTags. */
export const InjectTeamChatTags = (): TypedParameterDecorator<TeamChatTags> => injector<TeamChatTags>(TEAM_CHAT_TAGS)
