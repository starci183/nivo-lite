import { Module, type DynamicModule } from "@nestjs/common"
import { CassoProviderRegistrationService } from "./casso-provider-registration.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./casso-provider.module-definition"

@Module({})
/** Everything Casso-specific that core asks a provider for: today only its sandbox catalogue (the feed itself arrives by webhook). */
export class CassoProviderModule extends ConfigurableModuleClass {
    /** Registers the app's Casso provider once. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), CassoProviderRegistrationService] }
    }
}
