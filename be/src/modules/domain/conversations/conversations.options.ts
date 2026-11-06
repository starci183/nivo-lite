import type { Type } from "@nestjs/common"
import type { CustomerOutcomes } from "./conversations.contracts"

/** What the app root plugs into every customer turn: the outcome handler, optional. */
export interface ConversationsOptions {
    /** The handler of everything a reply starts; without it the reply is sent as proposed. */
    readonly outcomes?: Type<CustomerOutcomes>
}
