import { Module, type DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./openapi-provider.module-definition"
import { OpenApiProviderRegistrationService } from "./openapi-provider-registration.service"
import { OpenApiReachRegistryService } from "./openapi-reach-registry.service"
import { OpenApiSandboxFixturesRegistryService } from "./openapi-sandbox-fixtures-registry.service"
import { OpenApiSandboxReachService } from "./openapi-sandbox-reach.service"

@Module({})
/**
 * The OpenAPI provider's account reach (lane concept provider-sandbox): the registry that picks live or sandbox per account, the sandbox
 * reach, the packages' sandbox fixtures and the sandbox catalogue. Register it global in the app that runs the API connections' tools.
 */
export class OpenApiProviderModule extends ConfigurableModuleClass {
    /** Registers the OpenAPI provider once. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                OpenApiReachRegistryService,
                OpenApiSandboxFixturesRegistryService,
                OpenApiSandboxReachService,
                OpenApiProviderRegistrationService,
            ],
            exports: [OpenApiReachRegistryService, OpenApiSandboxFixturesRegistryService, OpenApiSandboxReachService],
        }
    }
}
