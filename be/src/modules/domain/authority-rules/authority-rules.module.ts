import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./authority-rules.module-definition"
import { AuthorityRulesService } from "./authority-rules.service"

@Module({})
/** The rule of the owner for each action of the registry, over the primary PostgreSQL connection. */
export class AuthorityRulesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), AuthorityRulesService],
            exports: [AuthorityRulesService],
        }
    }
}
