import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./zalo-wizard-drafts.module-definition"
import { ZaloWizardDraftsService } from "./zalo-wizard-drafts.service"

@Module({})
/** The keys the Zalo wizard handed over while the back end seals them, over the primary PostgreSQL connection. */
export class ZaloWizardDraftsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ZaloWizardDraftsService],
            exports: [ZaloWizardDraftsService],
        }
    }
}
