import type { RevokeApiKeyRequest, RevokeApiKeyResult } from "../../application/revoke-api-key.contracts"
import type { ApiKeyResponse } from "./dto/api-key.response"
import type { RevokeApiKeyRequest as RevokeApiKeyHttpRequest } from "./dto/revoke-api-key.request"

/** Maps the HTTP path to the command request. */
export const toRevokeApiKeyRequest = (input: RevokeApiKeyHttpRequest): RevokeApiKeyRequest => ({
    workspaceId: input.workspaceId,
    keyId: input.keyId,
})

/** Maps the command result to the HTTP response. */
export const toRevokeApiKeyResponse = (result: RevokeApiKeyResult): ApiKeyResponse => ({
    id: result.id,
    name: result.name,
    prefix: result.prefix,
    createdAt: result.createdAt,
    lastUsedAt: result.lastUsedAt,
    revokedAt: result.revokedAt,
})
