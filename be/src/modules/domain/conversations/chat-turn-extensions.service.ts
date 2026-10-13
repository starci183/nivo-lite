import { Injectable, Optional } from "@nestjs/common"
import type {
    ChatTurnExtensions,
    ChatTurnRuntime,
    CustomerOutcomes,
    RegisteredOutcomes,
    RegisteredRuntime,
} from "./conversations.contracts"
import { InjectChatTurnOutcomes, InjectChatTurnRuntime } from "./conversations.decorators"

@Injectable()
/** Holds the AI step and the outcome handler the app root plugs in; without them a turn falls back to the holding line. */
export class ChatTurnExtensionsService implements ChatTurnExtensions {
    constructor(
        @Optional() @InjectChatTurnRuntime() private readonly current?: ChatTurnRuntime,
        @Optional() @InjectChatTurnOutcomes() private readonly handler?: CustomerOutcomes,
    ) {}

    /** The plugged AI step, or undefined. */
    runtime(): RegisteredRuntime {
        return this.current
    }

    /** The plugged outcome handler, or undefined. */
    outcomes(): RegisteredOutcomes {
        return this.handler
    }
}
