import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { CreditsService } from "./credits.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./credits.module-definition"

@Module({})
/** The credits capability over the primary PostgreSQL connection: top-up packs, upgrade proration and the credits overview. */
export class CreditsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), CreditsService],
            exports: [CreditsService],
        }
    }
}
