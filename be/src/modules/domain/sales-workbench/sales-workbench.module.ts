import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./sales-workbench.module-definition"
import { SalesWorkbenchService } from "./sales-workbench.service"

@Module({})
/** Registers the Sales workbench projection over the globally composed owning capabilities. */
export class SalesWorkbenchModule extends ConfigurableModuleClass {
    /** Registers the capability once in the app composition root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), SalesWorkbenchService],
            exports: [SalesWorkbenchService],
        }
    }
}
