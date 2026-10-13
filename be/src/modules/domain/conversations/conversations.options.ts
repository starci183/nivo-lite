import type { Type } from "@nestjs/common"
import type { ChatTurnRuntime, CustomerOutcomes } from "./conversations.contracts"

/** What the app root plugs into every customer turn: the AI step and the outcome handler, each optional. */
export interface ConversationsOptions {
    /** The AI step that proposes a reply; without it a turn falls back to the holding line. */
    readonly runtime?: Type<ChatTurnRuntime>
    /** The handler of everything a reply starts; without it the reply is sent as proposed. */
    readonly outcomes?: Type<CustomerOutcomes>
}
