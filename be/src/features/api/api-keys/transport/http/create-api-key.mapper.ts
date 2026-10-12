import type { CreateApiKeyRequest, CreateApiKeyResult } from "../../application/create-api-key.contracts"
import type { CreateApiKeyRequest as CreateApiKeyHttpRequest } from "./dto/create-api-key.request"
import type { CreateApiKeyResponse } from "./dto/create-api-key.response"
import type { ListApiKeysRequest as WorkspacePath } from "./dto/list-api-keys.request"

/** Maps the workspace path and the body to the command request. */
export const toCreateApiKeyRequest = (path: WorkspacePath, input: CreateApiKeyHttpRequest): CreateApiKeyRequest => ({
    workspaceId: path.workspaceId,
    name: input.name,
})

/** Maps the command result to the HTTP response. */
export const toCreateApiKeyResponse = (result: CreateApiKeyResult): CreateApiKeyResponse => ({
    key: result.key,
    item: {
        id: result.item.id,
        name: result.item.name,
        prefix: result.item.prefix,
        createdAt: result.item.createdAt,
        lastUsedAt: result.item.lastUsedAt,
        revokedAt: result.item.revokedAt,
    },
})
