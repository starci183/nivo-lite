import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { AgentMessageKind } from "@nivo-lite/agent-sdk/team-chat"
import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import type { TeamChatTags } from "./team-chat.port"

/** Token of the tag port; the agents capability binds it. */
export const TEAM_CHAT_TAGS: unique symbol = Symbol("domain.team-chat.tags")

/** Token of the private object storage door the app root selects. */
export const TEAM_CHAT_STORAGE: unique symbol = Symbol("domain.team-chat.storage")

/** Injects the private object storage door. Parameter type: StorageObjectsPort. */
export const InjectTeamChatStorage = (): TypedParameterDecorator<StorageObjectsPort> =>
    injector<StorageObjectsPort>(TEAM_CHAT_STORAGE)

/** Injects the tag port. Parameter type: TeamChatTags. */
export const InjectTeamChatTags = (): TypedParameterDecorator<TeamChatTags> => injector<TeamChatTags>(TEAM_CHAT_TAGS)

/** What the executor of the team post asks to find the kind of a finished card: the plugin-registered kind of an id, or none. */
export type TeamCardKinds = (id: string) => AgentMessageKind | null

/** Token of the card kinds lookup; absent, the executor reads the installed plugins. */
export const TEAM_CARD_KINDS: unique symbol = Symbol("domain.team-chat.card-kinds")

/** Injects the card kinds lookup. Parameter type: TeamCardKinds. */
export const InjectTeamCardKinds = (): TypedParameterDecorator<TeamCardKinds> => injector<TeamCardKinds>(TEAM_CARD_KINDS)
