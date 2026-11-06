import { Injectable, Optional } from "@nestjs/common"
import type { ChatTurnExtensions, CustomerOutcomes, RegisteredOutcomes } from "./conversations.contracts"
import { InjectChatTurnOutcomes } from "./conversations.decorators"

@Injectable()
/** Holds the outcome handler the app root plugs in; without it a reply is sent as proposed. */
export class ChatTurnExtensionsService implements ChatTurnExtensions {
    constructor(@Optional() @InjectChatTurnOutcomes() private readonly handler?: CustomerOutcomes) {}

    /** The plugged outcome handler, or undefined. */
    outcomes(): RegisteredOutcomes {
        return this.handler
    }
}
