import { Module } from "@nestjs/common"
import { ProviderSandboxApiModule } from "../../provider-sandbox.module"
import { ConfigurableModuleClass } from "./provider-sandbox-graphql.module-definition"
import { ProviderSandboxResolver } from "./provider-sandbox.resolver"

@Module({
    imports: [ProviderSandboxApiModule.register({})],
    providers: [ProviderSandboxResolver],
})
/** The GraphQL transport of the provider-sandbox feature. */
export class ProviderSandboxGraphqlModule extends ConfigurableModuleClass {}
