import { InetError, InetErrorCode } from "@modules/integrations/inet"
import { inetFailureOf } from "./inet-domain-registrar.service"

/** What the sandbox says when a call times out (the cause the live client wraps from its transport). */
const NO_ANSWER = "sandbox: no answer in time"

/** The seconds the sandbox's rate refusal asks the caller to wait (the live client reads them from the answer's header). */
const RETRY_AFTER_SECONDS = 30

/**
 * The failure the live adapter throws for an iNET client failure of that code: the SAME `InetError` the client throws, passed through
 * the live adapter's own mapping (`inetFailureOf`), so the class, the code, the refusal reason and the proof (`not_sent` / `unknown`)
 * are the live ones by construction. The sandbox service builds no iNET error itself: it reaches no integration.
 */
const failureOf = (code: InetErrorCode, params: Readonly<Record<string, string | number>> = {}, cause?: unknown): Error => {
    const failure = inetFailureOf(new InetError({ code, params, ...(cause === undefined ? {} : { cause }) }))
    return failure instanceof Error ? failure : new Error(NO_ANSWER)
}

/** iNET refused the request as asked (its business refusal): the refusal `rejected` carrying the reason. */
export const inetRejected = (reason: string): Error => failureOf(InetErrorCode.Rejected, { reason })

/** iNET answered the resource already exists (409): the refusal `already_exists`. */
export const inetConflict = (): Error => failureOf(InetErrorCode.Conflict, { reason: "409" })

/** iNET answered a server failure (5xx): the effect is not known (proof `unknown`). */
export const inetServerError = (): Error => failureOf(InetErrorCode.Failed, { reason: "503" })

/** The API could not be reached or did not answer in time: the effect is not known (proof `unknown`). */
export const inetUnreachable = (): Error => failureOf(InetErrorCode.Unreachable, {}, new Error(NO_ANSWER))

/** iNET refused the key at its gateway (401): nothing was sent (proof `not_sent`). */
export const inetAuthRefused = (): Error => failureOf(InetErrorCode.AuthFailed, { reason: "401" })

/** iNET asked the caller to slow down (429): nothing was sent (proof `not_sent`). */
export const inetRateLimited = (): Error => failureOf(InetErrorCode.RateLimited, { retryAfterSeconds: RETRY_AFTER_SECONDS })
