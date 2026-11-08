import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { ChatTurnExtensions, CustomerOutcomes } from "./conversations.contracts"

/** Token of the registry where the owner of the outcomes plugs in. */
export const CHAT_TURN_EXTENSIONS: unique symbol = Symbol("domain.conversations.chat-turn-extensions")

/** Injects the registry the owner of the outcome handler registers it with. Parameter type: ChatTurnExtensions. */
export const InjectChatTurnExtensions = (): TypedParameterDecorator<ChatTurnExtensions> =>
    injector<ChatTurnExtensions>(CHAT_TURN_EXTENSIONS)

/** Token of the outcome handler the app root plugs in. */
export const CHAT_TURN_OUTCOMES: unique symbol = Symbol("domain.conversations.chat-turn-outcomes")

/** Injects the plugged outcome handler. Parameter type: CustomerOutcomes. */
export const InjectChatTurnOutcomes = (): TypedParameterDecorator<CustomerOutcomes> =>
    injector<CustomerOutcomes>(CHAT_TURN_OUTCOMES)
