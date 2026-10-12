import { Command } from "@nestjs/cqrs"
import type { GenerationOutcome } from "@modules/domain/ai-generations"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GenerateTextRequest } from "./generate-text.contracts"

/** Asks the agent engine to write a text. */
export class GenerateTextCommand extends Command<GenerationOutcome> {
    constructor(readonly params: ExecuteParams<GenerateTextRequest>) {
        super()
    }
}
