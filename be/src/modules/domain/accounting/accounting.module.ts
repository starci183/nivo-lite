import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./accounting.module-definition"
import { AccountingBookService } from "./accounting-book.service"
import { AccountingService } from "./accounting.service"

@Module({})
/** Registers the accounting capability once for the application. */
export class AccountingModule extends ConfigurableModuleClass {
    /** Registers the capability and exports its services. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), AccountingBookService, AccountingService],
            exports: [AccountingBookService, AccountingService],
        }
    }
}
