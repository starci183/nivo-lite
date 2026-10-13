import { Injectable } from "@nestjs/common"
import type {
    ChatTurnExtensions,
    ChatTurnRuntime,
    CustomerOutcomes,
    RegisteredOutcomes,
    RegisteredRuntime,
} from "./conversations.contracts"

@Injectable()
/** Holds the AI step and the outcome handler the owners of those flows plug in once at start; without them a turn falls back to the holding line. */
export class ChatTurnExtensionsService implements ChatTurnExtensions {
    private current: RegisteredRuntime = undefined
    private handler: RegisteredOutcomes = undefined

    /** Registers the AI step. */
    useRuntime(runtime: ChatTurnRuntime): void {
        this.current = runtime
    }

    /** Registers the outcome handler. */
    useOutcomes(outcomes: CustomerOutcomes): void {
        this.handler = outcomes
    }

    /** The registered AI step, or undefined. */
    runtime(): RegisteredRuntime {
        return this.current
    }

    /** The registered outcome handler, or undefined. */
    outcomes(): RegisteredOutcomes {
        return this.handler
    }
}
