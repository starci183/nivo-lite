import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
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
