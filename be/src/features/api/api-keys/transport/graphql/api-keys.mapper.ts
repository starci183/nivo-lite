import type { ApiKeyView, CreatedApiKey } from "@modules/domain/api-keys"
import type { ApiKeyType } from "./dto/api-key.type"
import type { CreatedApiKeyType } from "./dto/created-api-key.type"

/** Maps one key view to the GraphQL type. */
export const toApiKeyType = (view: ApiKeyView): ApiKeyType => ({ ...view })

/** Maps the keys of a workspace to the GraphQL type. */
export const toApiKeysType = (views: ReadonlyArray<ApiKeyView>): Array<ApiKeyType> => views.map((view) => ({ ...view }))

/** Maps a created key, with its one-time secret, to the GraphQL type. */
export const toCreatedApiKeyType = (created: CreatedApiKey): CreatedApiKeyType => ({
    key: created.key,
    item: { ...created.item },
})
