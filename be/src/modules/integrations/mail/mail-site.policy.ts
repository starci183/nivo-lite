const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])

/** True when the site address is a public https origin; a missing, plain-http or local address means a development site. */
export const isPublicSite = (siteUrl: string | undefined): boolean => {
    if (siteUrl === undefined || !URL.canParse(siteUrl)) return false
    const url = new URL(siteUrl)
    return url.protocol === "https:" && !LOCAL_HOSTS.has(url.hostname) && !url.hostname.endsWith(".localhost")
}
