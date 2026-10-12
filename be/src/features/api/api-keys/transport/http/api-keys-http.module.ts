import { Module } from "@nestjs/common"
import { ApiKeysApiModule } from "../../api-keys.module"
import { CreateApiKeyController } from "./create-api-key.controller"
import { ListApiKeysController } from "./list-api-keys.controller"
import { RevokeApiKeyController } from "./revoke-api-key.controller"

@Module({
    imports: [ApiKeysApiModule],
    controllers: [CreateApiKeyController, ListApiKeysController, RevokeApiKeyController],
})
/** The HTTP transport of the api-keys feature. */
export class ApiKeysHttpModule {}
