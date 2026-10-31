import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { WakeAgentsRequest } from "./wake-agents.contracts"

/** Asks to wake the agents that asked for one delivered internal event; the three event consumers send it for every delivery. */
export class WakeAgentsCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<WakeAgentsRequest>) {
        super()
    }
}
