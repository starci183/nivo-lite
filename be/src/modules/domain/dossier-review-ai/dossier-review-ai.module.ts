import { Module, type DynamicModule } from "@nestjs/common"
import { DossierReasonerService } from "./dossier-reasoner.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./dossier-review-ai.module-definition"

@Module({})
/** The model side of the shop-document critic: the service that reads one document critically. */
export class DossierReviewAiModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), DossierReasonerService],
            exports: [DossierReasonerService],
        }
    }
}
