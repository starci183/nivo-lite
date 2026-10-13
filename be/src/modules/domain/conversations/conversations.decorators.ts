import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ChatTurnExtensions, ChatTurnRuntime, CustomerOutcomes } from "./conversations.contracts"

/** Token of the registry where the owners of the AI step and of the outcomes plug in. */
export const CHAT_TURN_EXTENSIONS: unique symbol = Symbol("domain.conversations.chat-turn-extensions")

/** Injects the registry an owner registers the AI step or the outcome handler with. Parameter type: ChatTurnExtensions. */
export const InjectChatTurnExtensions = (): TypedParameterDecorator<ChatTurnExtensions> =>
    injector<ChatTurnExtensions>(CHAT_TURN_EXTENSIONS)

/** Token of the AI step the app root plugs in. */
export const CHAT_TURN_RUNTIME: unique symbol = Symbol("domain.conversations.chat-turn-runtime")

/** Token of the outcome handler the app root plugs in. */
export const CHAT_TURN_OUTCOMES: unique symbol = Symbol("domain.conversations.chat-turn-outcomes")

/** Injects the plugged AI step. Parameter type: ChatTurnRuntime. */
export const InjectChatTurnRuntime = (): TypedParameterDecorator<ChatTurnRuntime> =>
    injector<ChatTurnRuntime>(CHAT_TURN_RUNTIME)

/** Injects the plugged outcome handler. Parameter type: CustomerOutcomes. */
export const InjectChatTurnOutcomes = (): TypedParameterDecorator<CustomerOutcomes> =>
    injector<CustomerOutcomes>(CHAT_TURN_OUTCOMES)
