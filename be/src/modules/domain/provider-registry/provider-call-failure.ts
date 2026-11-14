import { callProofOf, providerCallFailure } from "./errors/provider-refusals"

/**
 * What a failed provider call proves about its effect, said by the adapter at the very place it failed (never read back from a
 * message): `not_sent` when the request never left (no account, no token, a refusal before the call), `unknown` when it may have
 * reached the provider (a timeout or a broken connection after the request left).
 */
export type ProviderCallProof = "not_sent" | "unknown"

/** The failures an adapter rethrows as they are (a retry upstream reads them) with what they prove attached. */
const PROVED = new WeakMap<object, ProviderCallProof>()

/**
 * The failure as it is, with what it proves attached where the adapter caught it: for a failure an adapter must rethrow unchanged (a
 * caller upstream reads its own type: a rate limit, a timeout). Anything that is no object is wrapped in a `providerCallFailure`.
 */
export function withProof<Cause extends object>(cause: Cause, proof: ProviderCallProof): Cause
/** A failure of no known shape: an object keeps its identity, anything else is wrapped in a `providerCallFailure`. */
export function withProof(cause: unknown, proof: ProviderCallProof): unknown
/** The implementation of both forms above. */
export function withProof(cause: unknown, proof: ProviderCallProof): unknown {
    if (typeof cause !== "object" || cause === null) return providerCallFailure(proof, cause)
    PROVED.set(cause, proof)
    return cause
}

/** The proof of a failure an adapter typed (`providerCallFailure` or `withProof`), or null for any other failure (it proves nothing). */
export const proofOf = (cause: unknown): ProviderCallProof | null => {
    const typed = callProofOf(cause)
    if (typed !== null) return typed
    return typeof cause === "object" && cause !== null ? (PROVED.get(cause) ?? null) : null
}
