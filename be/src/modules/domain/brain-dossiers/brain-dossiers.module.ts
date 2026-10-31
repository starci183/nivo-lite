import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./brain-dossiers.module-definition"
import { BrainDossiersReadService } from "./brain-dossiers-read.service"
import { BrainDossiersService } from "./brain-dossiers.service"

@Module({})
/** The dossiers a workspace tracks in its Second Brain: each with its category, status and what is still missing. */
export class BrainDossiersModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), BrainDossiersService, BrainDossiersReadService],
            exports: [BrainDossiersService, BrainDossiersReadService],
        }
    }
}
