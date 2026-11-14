import { Module, type DynamicModule } from "@nestjs/common"
import { MisaAmisLedgerService } from "./misa-amis-ledger.service"
import { MisaAmisProviderRegistrationService } from "./misa-amis-provider-registration.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./misa-amis-provider.module-definition"

@Module({})
/** Everything AMIS-specific core asks a provider for: a second owner of the ledger. The app imports `MisaAmisModule` beside it. */
export class MisaAmisProviderModule extends ConfigurableModuleClass {
    /** Registers the app's AMIS provider once. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), MisaAmisLedgerService, MisaAmisProviderRegistrationService],
            exports: [MisaAmisLedgerService],
        }
    }
}
