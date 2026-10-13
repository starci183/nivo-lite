import { Command } from "@nestjs/cqrs"
import type { GenerationRequested } from "@modules/domain/ai-generations"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestGenerationRequest } from "./request-generation.contracts"

/** Asks to queue a text on the agent engine and answer its id at once. */
export class RequestGenerationCommand extends Command<GenerationRequested> {
    constructor(readonly params: ExecuteParams<RequestGenerationRequest>) {
        super()
    }
}
