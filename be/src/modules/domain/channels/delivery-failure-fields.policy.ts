import { isDomainError } from "@modules/platform/errors"

/** The members of a provider error that may travel in a delivery log: the provider's numeric code, its reason, the endpoint path and the HTTP status. The body is left out, and so is anything that could name the recipient or hold a credential. */
const LOGGED: ReadonlySet<string> = new Set(["zaloCode", "reason", "path", "status"])

/**
 * What a failed outbound delivery adds to its log line besides the conversation: the code of the error and the provider's own answer
 * (Zalo's numeric code, its reason, which endpoint refused), so the line says why the channel refused and the mapping of Zalo's numbers can
 * be checked against real users. Anything that is not a domain error adds nothing.
 */
export const deliveryFailureFieldsOf = (cause: unknown): Readonly<Record<string, string | number>> => {
    if (!isDomainError(cause)) return {}
    const given = Object.entries(cause.params).filter(([name]) => LOGGED.has(name))
    return { errorCode: cause.code, ...Object.fromEntries(given) }
}
