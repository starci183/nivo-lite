import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./content-brand-proposals.module-definition"
import { ContentBrandProposalsService } from "./content-brand-proposals.service"

@Module({})
/** The content_brand_proposals capability over primary PostgreSQL. */
export class ContentBrandProposalsModule extends ConfigurableModuleClass {
    /** Registers the owning service once at the app root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ContentBrandProposalsService],
            exports: [ContentBrandProposalsService],
        }
    }
}
