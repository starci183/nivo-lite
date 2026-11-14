import { Module, type DynamicModule } from "@nestjs/common"
import { OrderCodesPolicy } from "./payos-order-code.policy"
import { PayosPaymentLinkService } from "./payos-payment-link.service"
import { PayosSandboxPaymentLinkService } from "./payos-sandbox-payment-link.service"
import { PayosProviderRegistrationService } from "./payos-provider-registration.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./payos-provider.module-definition"

@Module({})
/**
 * Everything payOS-specific that core asks a provider for, registered under the capability names: the payment-link purpose the generic
 * payment-link tools (`nivo.tool.payment.link.*`) run through. It needs the payOS client (`PayosModule`), the connection secrets and the
 * provider registry, registered globally by the app. payOS's webhook feed lives in billing (the bank-feed door) and is unchanged.
 */
export class PayosProviderModule extends ConfigurableModuleClass {
    /** Registers the app's payOS provider once. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), OrderCodesPolicy, PayosPaymentLinkService, PayosSandboxPaymentLinkService, PayosProviderRegistrationService],
            exports: [PayosPaymentLinkService],
        }
    }
}
