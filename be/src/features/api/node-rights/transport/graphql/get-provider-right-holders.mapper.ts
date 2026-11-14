import type { ProviderRightHolders } from "@modules/domain/node-right-rollups"
import type { GetProviderRightHoldersRequest } from "../../application/get-provider-right-holders.contracts"
import type { GetProviderRightHoldersInput } from "./dto/get-provider-right-holders.input"
import type { ProviderRightHoldersType } from "./dto/get-provider-right-holders.type"

/** Maps the GraphQL arguments of providerRightHolders to the request. */
export const toGetProviderRightHoldersRequest = (
    workspaceId: string,
    input: GetProviderRightHoldersInput,
): GetProviderRightHoldersRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of providerRightHolders to the GraphQL type: the capability already answers in its shape. */
export const toProviderRightHoldersType = (answer: ProviderRightHolders): ProviderRightHoldersType => answer
