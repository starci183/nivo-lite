import { Module, type DynamicModule, type Provider } from "@nestjs/common"
import { AccountCursorsService } from "./account-cursors.service"
import { AccountDataIntakeService } from "./account-data-intake.service"
import { AccountDataPageService } from "./account-data-page.service"
import { AccountDataPlanService } from "./account-data-plan.service"
import { AccountDataReadService } from "./account-data-read.service"
import { AccountDataRetentionService } from "./account-data-retention.service"
import { AccountDataTypesService } from "./account-data-types.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./account-data.module-definition"

/** The services every registration provides and exports. */
const SERVICES: ReadonlyArray<Provider> = [
    AccountDataTypesService,
    AccountDataIntakeService,
    AccountDataReadService,
    AccountCursorsService,
    AccountDataRetentionService,
    AccountDataPlanService,
]

@Module({})
/** The provider data of every account (connection): the one owner of public.account_data and its partitions, one per declared type. */
export class AccountDataModule extends ConfigurableModuleClass {
    /** Registers the capability once per app with the declared types, and the connection page read (the app provides the ConnectionsService). */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = AccountDataModule.withoutPages(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), AccountDataPageService],
            exports: [...(base.exports ?? []), AccountDataPageService],
        }
    }

    /** Registers the capability without the connection page read (the mcp app, whose connections are the bindings read only). */
    static withoutPages(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ...SERVICES],
            exports: [...SERVICES],
        }
    }
}
