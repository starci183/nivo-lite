import { isDomainError } from "@modules/platform/errors"

/** Names whose value is never logged: a credential an error might carry. */
const SECRET_NAME = /token|secret|password|authorization|key/iu

/**
 * What a failed poll adds to its log line: the code of a domain error and its params (a provider's own numeric code, the reason it gave, the endpoint
 * path, the status and a short redacted answer), so the log says why the provider refused. Only text and numbers travel, and never a field that
 * looks like a credential. Anything that is not a domain error adds nothing.
 */
export const failureFieldsOf = (cause: unknown): Readonly<Record<string, string | number>> => {
    if (!isDomainError(cause)) return {}
    const params = Object.entries(cause.params).filter(([name]) => !SECRET_NAME.test(name))
    return { errorCode: cause.code, ...Object.fromEntries(params) }
}
