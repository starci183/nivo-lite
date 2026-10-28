import type { RevealSepayKeyRequest, RevealSepayKeyResult } from "../../application/reveal-sepay-key.contracts"
import type { RevealSepayKeyInput } from "./dto/reveal-sepay-key.input"
import type { SepayKeyType } from "./dto/sepay-key.type"

/** Maps the GraphQL arguments of revealSepayKey to the request. */
export const toRevealSepayKeyRequest = (workspaceId: string, input: RevealSepayKeyInput): RevealSepayKeyRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of revealSepayKey to the GraphQL type. */
export const toRevealSepayKeyType = (result: RevealSepayKeyResult): SepayKeyType => result
