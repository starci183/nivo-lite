import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./owners.module-definition"
import { OwnersService } from "./owners.service"

@Module({})
/** Bootstraps the first account of a clean database from the operator command line. */
export class OwnersModule extends ConfigurableModuleClass {
    /** Registers the capability once in the cli app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), OwnersService], exports: [OwnersService] }
    }
}
