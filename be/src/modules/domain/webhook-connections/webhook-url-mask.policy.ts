/** A path segment this long that is only letters, digits, dash and underscore may be a secret token. */
const TOKEN_MIN_LENGTH = 16
const TOKEN_SHAPE = /^[A-Za-z0-9_-]+$/
const TOKEN_KEPT = 4

const maskSegment = (segment: string): string =>
    segment.length >= TOKEN_MIN_LENGTH && TOKEN_SHAPE.test(segment) ? `${segment.slice(0, TOKEN_KEPT)}...` : segment

/**
 * The address of a webhook as the owner may read it again: the scheme, the host and the path, with any segment that looks like a
 * secret token cut to its first characters. A webhook address often carries its secret in the path or the query, so the query, the
 * fragment and any user and password are never shown.
 */
export const maskedWebhookUrl = (target: URL): string => {
    const path = target.pathname.split("/").map((item) => maskSegment(item)).join("/")
    return `${target.protocol}//${target.host}${path === "/" ? "" : path}`
}
