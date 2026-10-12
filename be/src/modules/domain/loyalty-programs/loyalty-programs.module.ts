import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./loyalty-programs.module-definition"
import { LoyaltyProgramsService } from "./loyalty-programs.service"

@Module({})
/** The loyalty programs capability: the rules of each workspace's programme, read by the capabilities that apply them. */
export class LoyaltyProgramsModule extends ConfigurableModuleClass {
    /** Registers the capability for the capabilities that import it. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), LoyaltyProgramsService],
            exports: [LoyaltyProgramsService],
        }
    }
}
