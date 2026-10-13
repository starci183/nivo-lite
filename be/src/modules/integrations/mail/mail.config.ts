import type { EnvSource } from "@modules/platform/config"
import type { MailOptions } from "./mail.options"

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])

/** True when the site address is a public https origin; a missing, plain-http or local address means a development site. */
const isPublicSite = (siteUrl: string | undefined): boolean => {
    if (siteUrl === undefined || !URL.canParse(siteUrl)) return false
    const url = new URL(siteUrl)
    return url.protocol === "https:" && !LOCAL_HOSTS.has(url.hostname) && !url.hostname.endsWith(".localhost")
}

/** Reads the mail options: a private target is allowed on a development site or by an explicit flag; the platform sender is all-or-nothing. */
export const parseMailConfig = (env: EnvSource): MailOptions => ({
    allowPrivateHosts: !isPublicSite(env.optional("SITE_URL")) || env.bool("SMTP_ALLOW_PRIVATE_HOSTS", false),
    platform: env.anyDeclared(["SMTP_URL", "SMTP_FROM"])
        ? { url: env.secret("SMTP_URL"), from: env.string("SMTP_FROM") }
        : null,
    helloName: env.optional("SMTP_HELLO_NAME") ?? "nivo.vn",
})
