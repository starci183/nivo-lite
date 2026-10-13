import { Module } from "@nestjs/common"
import { CreateApiKeyHandler } from "./application/create-api-key.handler"
import { ListApiKeysHandler } from "./application/list-api-keys.handler"
import { RevokeApiKeyHandler } from "./application/revoke-api-key.handler"

@Module({ providers: [CreateApiKeyHandler, ListApiKeysHandler, RevokeApiKeyHandler] })
/** The api-keys feature: the handlers of its application. */
export class ApiKeysApiModule {}
