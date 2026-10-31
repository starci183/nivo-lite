import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./supplier-payables.module-definition"
import { SupplierPayablesService } from "./supplier-payables.service"

@Module({})
/** Registers the supplier-payables capability once for the application. */
export class SupplierPayablesModule extends ConfigurableModuleClass {
    /** Registers the capability and exports its service. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), SupplierPayablesService],
            exports: [SupplierPayablesService],
        }
    }
}
