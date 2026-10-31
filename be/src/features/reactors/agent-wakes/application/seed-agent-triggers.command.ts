import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { SeedAgentTriggersRequest } from "./seed-agent-triggers.contracts"

/** Asks to seed the triggers of the module of one changed installation; the installation_changed consumer sends it for every delivery. */
export class SeedAgentTriggersCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<SeedAgentTriggersRequest>) {
        super()
    }
}
