import { Module } from "@nestjs/common"
import { AnswerBrainCritiqueHandler } from "./application/answer-brain-critique.handler"
import { GetBrainCritiqueHandler } from "./application/get-brain-critique.handler"
import { ListBrainCritiquesHandler } from "./application/list-brain-critiques.handler"
import { ReleaseBrainCritiqueHandler } from "./application/release-brain-critique.handler"
import { RetryBrainCritiqueHandler } from "./application/retry-brain-critique.handler"
import { SkipBrainCritiqueHandler } from "./application/skip-brain-critique.handler"
import { ConfigurableModuleClass } from "./brain-critic.module-definition"

@Module({
    providers: [
        GetBrainCritiqueHandler,
        ListBrainCritiquesHandler,
        AnswerBrainCritiqueHandler,
        SkipBrainCritiqueHandler,
        RetryBrainCritiqueHandler,
        ReleaseBrainCritiqueHandler,
    ],
})
/** The document critique of the Second Brain page (the "document check" card): the handlers of its application. */
export class BrainCriticApiModule extends ConfigurableModuleClass {}
