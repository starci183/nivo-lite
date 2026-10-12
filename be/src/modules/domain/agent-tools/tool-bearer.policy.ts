/** Matches `Bearer <token>` in an Authorization header, any case of the scheme. */
const BEARER = /^Bearer\s+(\S+)\s*$/i

/** The token of an `Authorization: Bearer` header; an empty text when the header is absent or is another scheme, which the token check then refuses. */
export const bearerTokenOf = (header: string | undefined): string => BEARER.exec(header ?? "")?.[1] ?? ""
