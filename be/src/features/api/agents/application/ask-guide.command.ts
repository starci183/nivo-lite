import { Command } from "@nestjs/cqrs"
import type { GenerationEnqueued, GuideAsk } from "@modules/domain/ai-generations"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Asks the NIVO guide one question; answers the queued text to poll with the generation status. */
export class AskGuideCommand extends Command<GenerationEnqueued> {
    constructor(readonly params: ExecuteParams<GuideAsk>) {
        super()
    }
}
