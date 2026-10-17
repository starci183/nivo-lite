import { Module } from "@nestjs/common"
import { ApiKeysApiModule } from "../../api-keys.module"
import { ConfigurableModuleClass } from "./api-keys-graphql.module-definition"
import { CreateApiKeyResolver } from "./create-api-key.resolver"
import { ListApiKeysResolver } from "./list-api-keys.resolver"
import { RevokeApiKeyResolver } from "./revoke-api-key.resolver"

@Module({
    imports: [ApiKeysApiModule.register({})],
    providers: [ListApiKeysResolver, CreateApiKeyResolver, RevokeApiKeyResolver],
})
/** The GraphQL transport of the api-keys feature. */
export class ApiKeysGraphqlModule extends ConfigurableModuleClass {}
