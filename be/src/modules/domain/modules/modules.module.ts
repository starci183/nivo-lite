import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./modules.module-definition"
import { ModulesService } from "./modules.service"

@Module({})
/** The modules capability: the typed catalogue of installable agents and its mirror in the database. */
export class ModulesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app with the catalogue the app root names. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), ModulesService], exports: [ModulesService] }
    }
}
