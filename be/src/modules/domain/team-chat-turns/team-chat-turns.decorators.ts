import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { TeamChatTurnsOptions } from "./team-chat-turns.options"

/** Token of the chat turns' options, exported so a spec can provide them. */
export const TEAM_CHAT_TURNS_OPTIONS: unique symbol = Symbol("domain.team-chat-turns.options")

/** Injects the options of the chat turns. Parameter type: TeamChatTurnsOptions. */
export const InjectTeamChatTurnsOptions = (): TypedParameterDecorator<TeamChatTurnsOptions> =>
    injector<TeamChatTurnsOptions>(TEAM_CHAT_TURNS_OPTIONS)
