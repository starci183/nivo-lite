import type { RotateSepayKeyRequest, RotateSepayKeyResult } from "../../application/rotate-sepay-key.contracts"
import type { RotateSepayKeyInput } from "./dto/rotate-sepay-key.input"
import type { SepayKeyType } from "./dto/sepay-key.type"

/** Maps the GraphQL arguments of rotateSepayKey to the request. */
export const toRotateSepayKeyRequest = (workspaceId: string, input: RotateSepayKeyInput): RotateSepayKeyRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of rotateSepayKey to the GraphQL type. */
export const toRotateSepayKeyType = (result: RotateSepayKeyResult): SepayKeyType => result
