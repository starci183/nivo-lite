import { Module, type DynamicModule } from "@nestjs/common"
import { MetaFacebookPublishService } from "./meta-facebook-publish.service"
import { MetaInstagramPublishService } from "./meta-instagram-publish.service"
import { MetaPublishingCredentialService } from "./meta-publishing-credential.service"
import { MetaPublishingProviderRegistrationService } from "./meta-publishing-provider-registration.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./meta-publishing-provider.module-definition"

const PROVIDERS = [MetaPublishingCredentialService, MetaFacebookPublishService, MetaInstagramPublishService]

@Module({})
/**
 * Everything Meta-specific that core asks a provider for when it publishes: the Facebook destination and the Instagram destination,
 * registered under their own capability names. The app imports the Meta publishing integration (`MetaPublishingModule`) beside it.
 */
export class MetaPublishingProviderModule extends ConfigurableModuleClass {
    /** Registers the app's Meta publishing provider once. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ...PROVIDERS, MetaPublishingProviderRegistrationService],
            exports: PROVIDERS,
        }
    }
}
