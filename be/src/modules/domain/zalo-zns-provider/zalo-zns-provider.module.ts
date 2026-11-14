import { Module, type DynamicModule } from "@nestjs/common"
import { ZaloZnsProviderRegistrationService } from "./zalo-zns-provider-registration.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./zalo-zns-provider.module-definition"
import { ZaloZnsTemplateService } from "./zalo-zns-template.service"

@Module({})
/** The template-message delivery kind of the Zalo OA (ZNS), registered for the one customer send. */
export class ZaloZnsProviderModule extends ConfigurableModuleClass {
    /** Registers the ZNS provider once. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ZaloZnsTemplateService, ZaloZnsProviderRegistrationService],
            exports: [ZaloZnsTemplateService],
        }
    }
}
