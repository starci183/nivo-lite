import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./shell.module-definition"
import { ShellService } from "./shell.service"

@Module({})
/** The facts the console frame draws, read in one request. */
export class ShellModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), ShellService], exports: [ShellService] }
    }
}
