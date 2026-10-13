/** True when a host may be fetched for a link source: loopback, link-local and private networks are never fetched. */
export const isPublicHost = (host: string): boolean =>
    !/^(localhost|0\.0\.0\.0|\[?::1\]?)$/iu.test(host) &&
    !/\.(local|internal|localhost)$/iu.test(host) &&
    !/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/u.test(host)
