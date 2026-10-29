import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { QueueSourceFactsRequest } from "./queue-source-facts.contracts"

/** Asks to apply one delivered knowledge_source_indexed event; the knowledge_source_indexed consumer sends it for every delivery. */
export class QueueSourceFactsCommand extends Command<void> {
    constructor(readonly params: PublicExecuteParams<QueueSourceFactsRequest>) {
        super()
    }
}
