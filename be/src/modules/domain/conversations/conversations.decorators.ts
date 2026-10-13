import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ChatTurnExtensions } from "./conversations.contracts"

/** Token of the registry where the owners of the AI step and of the outcomes plug in. */
export const CHAT_TURN_EXTENSIONS: unique symbol = Symbol("domain.conversations.chat-turn-extensions")

/** Injects the registry an owner registers the AI step or the outcome handler with. Parameter type: ChatTurnExtensions. */
export const InjectChatTurnExtensions = (): TypedParameterDecorator<ChatTurnExtensions> =>
    injector<ChatTurnExtensions>(CHAT_TURN_EXTENSIONS)
