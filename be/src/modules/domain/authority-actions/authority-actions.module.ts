import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./authority-actions.module-definition"
import { AuthorityActionsService } from "./authority-actions.service"

@Module({})
/** The authority actions capability: the catalogue of governable actions in public.authority_actions. */
export class AuthorityActionsModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), AuthorityActionsService],
            exports: [AuthorityActionsService],
        }
    }
}
