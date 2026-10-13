import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./accounts.module-definition"
import { AccountsService } from "./accounts.service"

@Module({})
/** The signed-in person's own account: linked sign-in methods and signed-in devices. */
export class AccountsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), AccountsService], exports: [AccountsService] }
    }
}
