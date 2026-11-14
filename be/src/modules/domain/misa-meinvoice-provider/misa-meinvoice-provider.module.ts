import { Module, type DynamicModule } from "@nestjs/common"
import { MisaMeinvoiceInvoiceService } from "./misa-meinvoice-invoice.service"
import { MisaMeinvoiceProviderRegistrationService } from "./misa-meinvoice-provider-registration.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./misa-meinvoice-provider.module-definition"

@Module({})
/** Everything meInvoice-specific core asks a provider for: the e-invoice issue port. The app imports `MisaMeinvoiceModule` beside it. */
export class MisaMeinvoiceProviderModule extends ConfigurableModuleClass {
    /** Registers the app's meInvoice provider once. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), MisaMeinvoiceInvoiceService, MisaMeinvoiceProviderRegistrationService],
            exports: [MisaMeinvoiceInvoiceService],
        }
    }
}
