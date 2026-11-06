import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ChatRoomDirectory } from "./chat-room-directory.contracts"

/** Token of the team-chat room directory, exported so a spec can provide it. */
export const CHAT_ROOM_DIRECTORY: unique symbol = Symbol("domain.chat-room-directory.directory")

/** Injects the team-chat room directory. Parameter type: ChatRoomDirectory. */
export const InjectChatRoomDirectory = (): TypedParameterDecorator<ChatRoomDirectory> =>
    injector<ChatRoomDirectory>(CHAT_ROOM_DIRECTORY)
