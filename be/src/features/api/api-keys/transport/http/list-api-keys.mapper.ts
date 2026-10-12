import type { ListApiKeysRequest, ListApiKeysResult } from "../../application/list-api-keys.contracts"
import type { ListApiKeysRequest as ListApiKeysHttpRequest } from "./dto/list-api-keys.request"
import type { ListApiKeysResponse } from "./dto/list-api-keys.response"

/** Maps the HTTP path to the query request. */
export const toListApiKeysRequest = (input: ListApiKeysHttpRequest): ListApiKeysRequest => ({
    workspaceId: input.workspaceId,
})

/** Maps the query result to the HTTP response. */
export const toListApiKeysResponse = (result: ListApiKeysResult): ListApiKeysResponse => ({
    items: result.map((key) => ({
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt,
        revokedAt: key.revokedAt,
    })),
})
