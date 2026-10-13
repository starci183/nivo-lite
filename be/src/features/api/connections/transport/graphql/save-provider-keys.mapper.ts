import type { SaveProviderKeysRequest } from "../../application/save-provider-keys.contracts"
import type { ProviderKeysResult } from "@modules/domain/channel-connections"
import type { SaveProviderKeysInput } from "./dto/save-provider-keys.input"
import type { ProviderKeysResultType } from "./dto/provider-keys-result.type"

/** Maps the GraphQL arguments of saveProviderKeys to the request. */
export const toSaveProviderKeysRequest = (
    workspaceId: string,
    input: SaveProviderKeysInput,
): SaveProviderKeysRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    values: input.values,
})

/** Maps the answer of saveProviderKeys to the GraphQL type. */
export const toSaveProviderKeysType = (result: ProviderKeysResult): ProviderKeysResultType => result
