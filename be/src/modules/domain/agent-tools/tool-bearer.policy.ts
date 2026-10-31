/** Matches `Bearer <token>` in an Authorization header, any case of the scheme. */
const BEARER = /^Bearer\s+(\S+)\s*$/i

/** The token of an `Authorization: Bearer` header; an empty text when the header is absent or is another scheme, which the token check then refuses. */
export const bearerTokenOf = (header: string | undefined): string => BEARER.exec(header ?? "")?.[1] ?? ""

/** Marks the signed credential of the OpenClaw bridge plugin, which names a running turn instead of a job. */
const BRIDGE_PREFIX = "bridge."

/** True when a bearer token is the bridge plugin's signed credential and not a per-job tool token. */
export const isBridgeToken = (token: string): boolean => token.startsWith(BRIDGE_PREFIX)
