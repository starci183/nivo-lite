import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { DossierReasonerService } from "./dossier-reasoner.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./dossier-review-ai.module-definition"
import { RemedyWriterService } from "./remedy-writer.service"

@Module({})
/** The model side of the dossier review: the reasoner that reads a dossier critically and the writer that drafts what completes it. */
export class DossierReviewAiModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), DossierReasonerService, RemedyWriterService],
            exports: [DossierReasonerService, RemedyWriterService],
        }
    }
}
