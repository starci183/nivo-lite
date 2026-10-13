import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./leadgen-workbench.module-definition"
import { LeadGenWorkbenchService } from "./leadgen-workbench.service"

@Module({})
/** The read projection of the Lead Gen workbench over existing domain readers. */
export class LeadGenWorkbenchModule extends ConfigurableModuleClass {
    /** Registers the projection once in the app composition root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), LeadGenWorkbenchService],
            exports: [LeadGenWorkbenchService],
        }
    }
}
